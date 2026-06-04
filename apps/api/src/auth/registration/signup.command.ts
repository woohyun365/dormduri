import type { LoginResult, SignupInput } from '../domain/auth.types.js';
import { isKnuEmail, normalizeEmail, normalizeNickname } from '../domain/auth.utils.js';
import type { AuthVerificationService } from '../verification/auth-verification.service.js';
import type { AuthSessionService } from '../sessions/auth-session.service.js';
import { toLoginSuccessResult } from '../mappers/auth-response.builder.js';
import { toAuthSessionUserSummary } from '../mappers/auth-user-view.js';
import type { AuthSignupValidationService } from './auth-signup-validation.service.js';
import { authFailures } from '../errors/auth-failures.js';
import { hashPassword } from '../credentials/password-hash.js';
import {
  acquireVerificationCodePurposeLock,
  consumeVerifiedCodeOrThrow,
  SIGNUP_VERIFICATION_PROOF_UNAVAILABLE,
} from '../verification/auth-verification-proof.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import {
  isPrismaKnownRequestError,
  prismaErrorTargetIncludes,
} from '../../platform/database/prisma-error.js';

interface AuthSignupOwnerDeps {
  prisma: PrismaService;
  verificationService: Pick<AuthVerificationService, 'findLatestVerifiedSignupCode'>;
  sessionService: Pick<AuthSessionService, 'issueAuthResult'>;
  signupValidationService: Pick<AuthSignupValidationService, 'validateDraft'>;
}

export async function signup(deps: AuthSignupOwnerDeps, input: SignupInput): Promise<LoginResult> {
  const emailNormalized = normalizeEmail(input.email);
  if (!isKnuEmail(emailNormalized)) {
    return authFailures.invalidKnuEmail();
  }

  const preflight = await deps.signupValidationService.validateDraft({
    email: input.email,
    password: input.password,
    nickname: input.nickname,
  });

  if (!preflight.success) {
    return authFailures.signupValidation(
      preflight.fieldErrors?.nickname ??
        preflight.fieldErrors?.password ??
        preflight.fieldErrors?.email ??
        preflight.error ??
        '입력값을 다시 확인해주세요.',
      preflight.fieldErrors,
    );
  }

  const normalizedNickname = normalizeNickname(input.nickname);
  const [existingEmailUser, existingNicknameUser] = await Promise.all([
    deps.prisma.user.findUnique({
      where: { emailNormalized },
      select: { id: true },
    }),
    deps.prisma.userDisplayIdentity.findUnique({
      where: { nicknameNormalized: normalizedNickname },
      select: { userId: true },
    }),
  ]);

  if (existingEmailUser) {
    return authFailures.emailAlreadyRegistered();
  }
  if (existingNicknameUser) {
    return authFailures.nicknameAlreadyTaken();
  }

  const verifiedCode = await deps.verificationService.findLatestVerifiedSignupCode(emailNormalized);
  if (!verifiedCode) {
    return authFailures.signupVerificationRequired();
  }

  const passwordHash = await hashPassword(input.password);
  const emailVerifiedAt = await deps.prisma.getDatabaseNow();

  try {
    const user = await deps.prisma.runSerializableTransaction(async (tx) => {
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
              nickname: input.nickname.trim(),
              nicknameNormalized: normalizedNickname,
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

      await acquireVerificationCodePurposeLock(tx, emailNormalized, 'SIGNUP');
      await consumeVerifiedCodeOrThrow(
        tx,
        verifiedCode.id,
        emailVerifiedAt,
        SIGNUP_VERIFICATION_PROOF_UNAVAILABLE,
      );

      return { ...createdUser, displayIdentity };
    });

    const authResult = await deps.sessionService.issueAuthResult(user.id, user.email, false);
    return toLoginSuccessResult(
      authResult.accessToken,
      toAuthSessionUserSummary({
        id: user.id,
        email: user.email,
        nickname: user.displayIdentity.nickname,
        gender: user.gender,
        campus: user.campus,
      }),
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
    if (error instanceof Error && error.message === SIGNUP_VERIFICATION_PROOF_UNAVAILABLE) {
      return authFailures.signupVerificationRequired();
    }
    throw error;
  }
}
