import type { LoginResult, SignupInput } from '../domain/auth.types.js';
import { isCollegeAvailableForCampus } from '@repo/shared/college';
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

const SIGNUP_COLLEGE_UNAVAILABLE = 'AUTH_SIGNUP_COLLEGE_UNAVAILABLE';

interface AuthSignupOwnerDeps {
  prisma: PrismaService;
  verificationService: Pick<
    AuthVerificationService,
    'resolveVerificationGrant' | 'matchesVerificationGrantSubject'
  >;
  sessionService: Pick<AuthSessionService, 'issueAuthResult'>;
  nicknamePolicy: Pick<DisplayIdentityNicknamePolicyService, 'validate'>;
}

export async function signup(
  deps: AuthSignupOwnerDeps,
  input: SignupInput,
  verificationGrant: string | null = null,
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
    return authFailures.signupVerificationRequired();
  }

  const passwordError = validatePasswordPolicy(input.password, emailNormalized);
  if (passwordError) {
    return authFailures.passwordPolicyViolation(passwordError);
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

  const existingEmailUser = await deps.prisma.user.findUnique({
    where: { emailNormalized },
    select: { id: true },
  });

  if (existingEmailUser) {
    return authFailures.emailAlreadyRegistered();
  }

  const passwordHash = await hashPassword(input.password);
  const emailVerifiedAt = await deps.prisma.getDatabaseNow();

  try {
    const user = await deps.prisma.runSerializableTransaction(async (tx) => {
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
      await createSignupLegalAcceptanceRecords(tx, createdUser.id, legalAcceptances);

      return { ...createdUser, displayIdentity };
    });

    const authResult = await deps.sessionService
      .issueAuthResult(user.id, user.email, false)
      .catch(() => null);
    if (!authResult) {
      return authFailures.accountCreatedLoginRequired();
    }
    return toLoginSuccessResult(
      authResult.accessToken,
      toAuthSessionUserSummary({
        id: user.id,
        email: user.email,
        nickname: user.displayIdentity.nickname,
        gender: user.gender,
        campus: user.campus,
      }),
      {
        renewalToken: authResult.renewalToken,
        rememberMe: false,
      },
    );
  } catch (error) {
    if (isPrismaKnownRequestError(error, 'P2002')) {
      if (prismaErrorTargetIncludes(error, 'emailNormalized')) {
        return authFailures.emailAlreadyRegistered();
      }
      if (prismaErrorTargetIncludes(error, 'nicknameNormalized')) {
        return authFailures.nicknameAlreadyTaken();
      }
    }
    if (error instanceof Error && error.message === SIGNUP_VERIFICATION_GRANT_UNAVAILABLE) {
      return authFailures.signupVerificationRequired();
    }
    if (error instanceof Error && error.message === SIGNUP_LEGAL_ACCEPTANCE_STALE) {
      return authFailures.legalAcceptanceStale();
    }
    if (error instanceof Error && error.message === SIGNUP_COLLEGE_UNAVAILABLE) {
      return authFailures.signupCollegeUnavailable();
    }
    throw error;
  }
}
