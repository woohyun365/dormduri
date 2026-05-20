import { Prisma } from '../generated/prisma/client.js';
import type { LoginResult, SignupInput } from './auth.types.js';
import { isKnuEmail, normalizeEmail, normalizeNickname } from './auth.utils.js';
import type { AuthVerificationService } from './auth-verification.service.js';
import type { AuthSessionService } from './auth-session.service.js';
import { toLoginSuccessResult } from './auth-response.builder.js';
import { toAuthSessionUserSummary } from './auth-user-view.js';
import type { AuthSignupValidationService } from './auth-signup-validation.service.js';
import { authFailures } from './auth-failures.js';
import { hashPassword } from './auth-password.js';
import {
  consumeVerifiedCodeOrThrow,
  SIGNUP_VERIFICATION_PROOF_UNAVAILABLE,
} from './auth-verification-proof.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';

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
        },
      });

      if (!createdUser.displayIdentity) {
        throw new Error('[AuthSignupOwner] user display identity row is required');
      }
      const displayIdentity = createdUser.displayIdentity;

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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(',') : '';
      if (target.includes('emailNormalized')) {
        return authFailures.emailAlreadyRegistered();
      }
      if (target.includes('nicknameNormalized')) {
        return authFailures.nicknameAlreadyTaken();
      }
    }
    if (error instanceof Error && error.message === SIGNUP_VERIFICATION_PROOF_UNAVAILABLE) {
      return authFailures.signupVerificationRequired();
    }
    throw error;
  }
}
