import type { LoginResult, SignupInput } from '../domain/auth.types.js';
import { isCollegeAvailableForCampus } from '@repo/shared/college';
import { randomUUID } from 'node:crypto';
import { isKnuEmail, normalizeEmail, validatePasswordPolicy } from '../domain/auth.utils.js';
import type { AuthVerificationService } from '../verification/auth-verification.service.js';
import type { AuthSessionService } from '../sessions/auth-session.service.js';
import { toLoginSuccessResult } from '../mappers/auth-response.builder.js';
import { toAuthSessionUserSummary } from '../mappers/auth-user-view.js';
import { authFailures } from '../errors/auth-failures.js';
import { hashPassword } from '../credentials/password-hash.js';
import {
  acquireVerificationCodePurposeLock,
  consumeVerificationGrantOrThrow,
  SIGNUP_VERIFICATION_GRANT_UNAVAILABLE,
} from '../verification/verification-grant-consumption.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import {
  isPrismaKnownRequestError,
  prismaErrorTargetIncludes,
} from '../../platform/database/prisma-error.js';
import {
  createSignupLegalAcceptanceRecords,
  resolveSignupLegalAcceptances,
  SIGNUP_LEGAL_ACCEPTANCE_STALE,
} from '../../legal/commands/record-legal-acceptance.command.js';
import {
  DisplayIdentityNicknamePolicyError,
  type DisplayIdentityNicknamePolicyService,
  type ParsedDisplayIdentityNickname,
} from '../../users/identity/display/display-identity-nickname-policy.service.js';
import type { AuthRequestContext } from '../domain/auth-request-context.js';
import type { SignupSubmissionAdmissionService } from './signup-submission-admission.service.js';
import type { AuthSecurityEventService } from '../security-events/auth-security-event.service.js';
import type { AuthFlowMetricsService } from '../operations/auth-flow-metrics.service.js';
import {
  AUTH_PASSWORD_RISK_REJECTION_MESSAGE,
  type AuthPasswordPolicyService,
} from '../credentials/password-policy.service.js';

const SIGNUP_COLLEGE_UNAVAILABLE = 'AUTH_SIGNUP_COLLEGE_UNAVAILABLE';

interface AuthSignupOwnerDeps {
  prisma: PrismaService;
  verificationService: Pick<
    AuthVerificationService,
    'resolveVerificationGrant' | 'matchesVerificationGrantSubject'
  >;
  sessionService: Pick<AuthSessionService, 'prepareSessionIssue' | 'appendPreparedSession'>;
  passwordPolicy: Pick<AuthPasswordPolicyService, 'evaluateNewPassword'>;
  nicknamePolicy: Pick<DisplayIdentityNicknamePolicyService, 'validate'>;
  submissionAdmission: Pick<SignupSubmissionAdmissionService, 'consume'>;
  securityEvents: Pick<AuthSecurityEventService, 'recordInTransaction'>;
  flowMetrics?: Pick<
    AuthFlowMetricsService,
    'recordSignupFinalAdmission' | 'recordSignupPasswordHash' | 'recordSensitiveMutation'
  >;
}

export async function signup(
  deps: AuthSignupOwnerDeps,
  input: SignupInput,
  verificationGrant: string | null = null,
  requestContext: AuthRequestContext = {},
): Promise<LoginResult> {
  const emailNormalized = normalizeEmail(input.email);
  if (!isKnuEmail(emailNormalized)) {
    return authFailures.invalidKnuEmail();
  }
  if (!isCollegeAvailableForCampus(input.campus, input.collegeCode)) {
    return authFailures.signupCollegeUnavailable();
  }

  const resolvedGrant = await deps.verificationService.resolveVerificationGrant(
    verificationGrant,
    'SIGNUP',
  );
  if (
    !resolvedGrant ||
    !deps.verificationService.matchesVerificationGrantSubject(resolvedGrant, emailNormalized)
  ) {
    deps.flowMetrics?.recordSignupFinalAdmission('grant_required');
    return authFailures.signupVerificationRequired();
  }

  const retryAfterSeconds = await deps.submissionAdmission.consume(resolvedGrant.tokenHash);
  if (retryAfterSeconds) {
    return authFailures.signupSubmissionThrottled(retryAfterSeconds);
  }

  const passwordError = validatePasswordPolicy(input.password, emailNormalized);
  if (passwordError) {
    return authFailures.passwordPolicyViolation(passwordError);
  }

  const passwordRisk = deps.passwordPolicy.evaluateNewPassword(input.password, {
    email: emailNormalized,
    nickname: input.nickname,
  });
  if (!passwordRisk.ok) {
    return authFailures.passwordPolicyViolation(AUTH_PASSWORD_RISK_REJECTION_MESSAGE);
  }

  let parsedNickname: ParsedDisplayIdentityNickname;
  try {
    parsedNickname = await deps.nicknamePolicy.validate(input.nickname);
  } catch (error) {
    if (!(error instanceof DisplayIdentityNicknamePolicyError)) {
      throw error;
    }
    if (error.reason === 'ALREADY_TAKEN') {
      return authFailures.nicknameAlreadyTaken();
    }
    return authFailures.signupValidation(error.message, { nickname: error.message });
  }

  const hashStartedAt = performance.now();
  deps.flowMetrics?.recordSignupPasswordHash('started');
  let passwordHash: string;
  try {
    passwordHash = await hashPassword(input.password);
    deps.flowMetrics?.recordSignupPasswordHash(
      'completed',
      (performance.now() - hashStartedAt) / 1_000,
    );
  } catch (error) {
    deps.flowMetrics?.recordSignupPasswordHash(
      'failed',
      (performance.now() - hashStartedAt) / 1_000,
    );
    deps.flowMetrics?.recordSensitiveMutation('signup', 'failed');
    throw error;
  }
  const emailVerifiedAt = await deps.prisma.getDatabaseNow();
  const userId = randomUUID();
  const preparedSession = await deps.sessionService.prepareSessionIssue(
    userId,
    input.email.trim(),
    false,
  );

  try {
    const user = await deps.prisma.runSerializableTransaction(async (tx) => {
      await acquireVerificationCodePurposeLock(tx, resolvedGrant.subjectKey, 'SIGNUP');
      await consumeVerificationGrantOrThrow(
        tx,
        {
          id: resolvedGrant.id,
          purpose: resolvedGrant.purpose,
          tokenHash: resolvedGrant.tokenHash,
        },
        emailVerifiedAt,
        SIGNUP_VERIFICATION_GRANT_UNAVAILABLE,
      );

      const college = await tx.collegeMaster.findFirst({
        where: {
          code: input.collegeCode,
          campusCode: input.campus,
          isActive: true,
        },
        select: { code: true },
      });
      if (!college) {
        throw new Error(SIGNUP_COLLEGE_UNAVAILABLE);
      }

      const legalAcceptances = await resolveSignupLegalAcceptances(
        tx,
        input.legalAcceptances,
        emailVerifiedAt,
      );
      const createdUser = await tx.user.create({
        data: {
          id: userId,
          email: input.email.trim(),
          emailNormalized,
          passwordHash,
          gender: input.gender,
          campus: input.campus,
          emailVerifiedAt,
          displayIdentity: {
            create: {
              nickname: parsedNickname.value,
              nicknameNormalized: parsedNickname.normalized,
            },
          },
          academicIdentity: {
            create: {
              collegeCode: input.collegeCode,
              birthYear: input.birthYear,
            },
          },
        },
        select: {
          id: true,
          email: true,
          gender: true,
          campus: true,
          displayIdentity: {
            select: {
              nickname: true,
            },
          },
          academicIdentity: {
            select: {
              collegeCode: true,
              birthYear: true,
            },
          },
        },
      });

      if (!createdUser.displayIdentity) {
        throw new Error('[AuthSignupOwner] user display identity row is required');
      }
      const displayIdentity = createdUser.displayIdentity;

      await createSignupLegalAcceptanceRecords(tx, createdUser.id, legalAcceptances);
      await deps.sessionService.appendPreparedSession(tx, preparedSession);
      await deps.securityEvents.recordInTransaction(tx, {
        type: 'ACCOUNT_SIGNUP_SUCCEEDED',
        severity: 'INFO',
        actorUserId: createdUser.id,
        targetUserId: createdUser.id,
        sessionId: preparedSession.result.sessionId,
        emailNormalized,
        requestIp: requestContext.requestIp,
        userAgent: requestContext.userAgent,
        metadata: { campus: createdUser.campus },
      });

      return { ...createdUser, displayIdentity };
    });

    deps.flowMetrics?.recordSensitiveMutation('signup', 'committed');
    return toLoginSuccessResult(
      preparedSession.result.accessToken,
      toAuthSessionUserSummary({
        id: user.id,
        email: user.email,
        nickname: user.displayIdentity.nickname,
        gender: user.gender,
        campus: user.campus,
      }),
      {
        renewalToken: preparedSession.result.renewalToken,
        rememberMe: false,
      },
    );
  } catch (error) {
    if (isPrismaKnownRequestError(error, 'P2002')) {
      if (prismaErrorTargetIncludes(error, 'emailNormalized')) {
        return authFailures.emailAlreadyRegistered();
      }
      if (prismaErrorTargetIncludes(error, 'nicknameNormalized')) {
        deps.flowMetrics?.recordSensitiveMutation('signup', 'stale');
        return authFailures.nicknameAlreadyTaken();
      }
    }
    if (error instanceof Error && error.message === SIGNUP_VERIFICATION_GRANT_UNAVAILABLE) {
      deps.flowMetrics?.recordSensitiveMutation('signup', 'stale');
      return authFailures.signupVerificationRequired();
    }
    if (error instanceof Error && error.message === SIGNUP_LEGAL_ACCEPTANCE_STALE) {
      deps.flowMetrics?.recordSensitiveMutation('signup', 'rejected');
      return authFailures.legalAcceptanceStale();
    }
    if (error instanceof Error && error.message === SIGNUP_COLLEGE_UNAVAILABLE) {
      deps.flowMetrics?.recordSensitiveMutation('signup', 'rejected');
      return authFailures.signupCollegeUnavailable();
    }
    deps.flowMetrics?.recordSensitiveMutation('signup', 'failed');
    throw error;
  }
}
