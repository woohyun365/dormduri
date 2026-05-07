import { Injectable } from '@nestjs/common';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type {
  GenericSuccessResult,
  LoginResult,
  SessionStatusResult,
  SignupInput,
} from './auth.types.js';
import {
  isKnuEmail,
  normalizeEmail,
  normalizeNickname,
  validatePasswordPolicy,
} from './auth.utils.js';
import { validateLifestyleData } from './lifestyle.schema.js';
import { AuthVerificationService } from './auth-verification.service.js';
import { AuthSessionService } from './auth-session.service.js';
import { AuthLoginAttemptService } from './auth-login-attempt.service.js';
import { toLoginSuccessResult } from './auth-response.builder.js';
import { toAuthSessionUserSummary } from './auth-user-view.js';
import { ModerationService } from '../common/moderation/moderation.service.js';
import { AuthSignupValidationService } from './auth-signup-validation.service.js';
import type { SignupProfileValidationResponse } from '@repo/shared/auth-response';
import { authFailures } from './auth-failures.js';

const SIGNUP_VERIFICATION_PROOF_UNAVAILABLE = '[AuthService] signup verification proof unavailable';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationService: AuthVerificationService,
    private readonly sessionService: AuthSessionService,
    private readonly loginAttemptService: AuthLoginAttemptService,
    private readonly moderationService: ModerationService,
    private readonly signupValidationService: AuthSignupValidationService,
  ) {}

  async sendSignupCode(email: string, requestIp: string | null): Promise<GenericSuccessResult> {
    const emailNormalized = normalizeEmail(email);
    if (!isKnuEmail(emailNormalized)) {
      return authFailures.invalidKnuEmail();
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { emailNormalized },
      select: { id: true },
    });

    return this.verificationService.maybeSendSignupCode(
      emailNormalized,
      Boolean(existingUser),
      requestIp,
    );
  }

  async sendResetCode(email: string, requestIp: string | null): Promise<GenericSuccessResult> {
    const emailNormalized = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
      select: { id: true },
    });

    return this.verificationService.maybeSendResetCode(emailNormalized, Boolean(user), requestIp);
  }

  async verifyEmailCode(email: string, code: string): Promise<GenericSuccessResult> {
    return this.verificationService.verifyEmailCode(email, code);
  }

  async verifyResetCode(email: string, code: string): Promise<GenericSuccessResult> {
    return this.verificationService.verifyResetCode(email, code);
  }

  async getSession(token: string | null): Promise<SessionStatusResult> {
    return this.sessionService.getSession(token);
  }

  async validateSignupProfileDraft(input: {
    email: string;
    password: string;
    nickname: string;
  }): Promise<SignupProfileValidationResponse> {
    return this.signupValidationService.validateDraft(input);
  }

  async signup(input: SignupInput): Promise<LoginResult> {
    const emailNormalized = normalizeEmail(input.email);
    if (!isKnuEmail(emailNormalized)) {
      return authFailures.invalidKnuEmail();
    }

    const preflight = await this.signupValidationService.validateDraft({
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

    const lifestyleValidation = validateLifestyleData(input.lifestyle);
    if (!lifestyleValidation.ok) {
      return authFailures.invalidLifestyle(lifestyleValidation.error);
    }

    const introModeration = await this.moderationService.moderatePublicText(input.intro, 'intro');
    if (!introModeration.ok) {
      return authFailures.introRejected(introModeration.error);
    }

    const normalizedNickname = normalizeNickname(input.nickname);
    const [existingEmailUser, existingNicknameUser] = await Promise.all([
      this.prisma.user.findUnique({
        where: { emailNormalized },
        select: { id: true },
      }),
      this.prisma.userProfile.findUnique({
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

    const verifiedCode =
      await this.verificationService.findLatestVerifiedSignupCode(emailNormalized);
    if (!verifiedCode) {
      return authFailures.signupVerificationRequired();
    }

    const passwordHash = await this.hashPassword(input.password);

    const emailVerifiedAt = await this.prisma.getDatabaseNow();
    try {
      const user = await this.prisma.runSerializableTransaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email: input.email.trim(),
            emailNormalized,
            passwordHash,
            gender: input.gender,
            campus: input.campus,
            emailVerifiedAt,
            profile: {
              create: {
                nickname: input.nickname.trim(),
                nicknameNormalized: normalizedNickname,
                lifestyle: lifestyleValidation.value,
                intro: input.intro.trim(),
              },
            },
          },
          select: {
            id: true,
            email: true,
            gender: true,
            campus: true,
            profile: {
              select: {
                nickname: true,
              },
            },
          },
        });

        const consumeResult = await tx.verificationCode.updateMany({
          where: {
            id: verifiedCode.id,
            consumedAt: null,
          },
          data: {
            consumedAt: emailVerifiedAt,
          },
        });

        if (consumeResult.count !== 1) {
          throw new Error(SIGNUP_VERIFICATION_PROOF_UNAVAILABLE);
        }

        return createdUser;
      });

      const authResult = await this.sessionService.issueAuthResult(user.id, user.email, false);
      return toLoginSuccessResult(
        authResult.accessToken,
        toAuthSessionUserSummary({
          id: user.id,
          email: user.email,
          nickname: user.profile?.nickname ?? input.nickname.trim(),
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

  async login(email: string, password: string, rememberMe: boolean): Promise<LoginResult> {
    const emailNormalized = normalizeEmail(email);
    const activeLock = await this.loginAttemptService.getActiveLock(emailNormalized);
    if (activeLock) {
      return activeLock;
    }

    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        gender: true,
        campus: true,
        profile: {
          select: {
            nickname: true,
          },
        },
      },
    });

    if (!user) {
      return this.loginAttemptService.recordLoginFailure(emailNormalized);
    }

    const passwordMatches = await argonVerify(user.passwordHash, password);
    if (!passwordMatches) {
      return this.loginAttemptService.recordLoginFailure(emailNormalized);
    }

    await this.loginAttemptService.clearFailures(emailNormalized);

    const authResult = await this.sessionService.issueAuthResult(user.id, user.email, rememberMe);
    return toLoginSuccessResult(
      authResult.accessToken,
      toAuthSessionUserSummary({
        id: user.id,
        email: user.email,
        nickname: user.profile?.nickname ?? '',
        gender: user.gender,
        campus: user.campus,
      }),
    );
  }

  async resetPassword(email: string, newPassword: string): Promise<GenericSuccessResult> {
    const emailNormalized = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
    });

    if (!user) {
      return authFailures.resetRestartRequired();
    }

    const passwordError = validatePasswordPolicy(newPassword, user.email);
    if (passwordError) {
      return authFailures.passwordPolicyViolation(passwordError, 'newPassword');
    }

    const samePassword = await argonVerify(user.passwordHash, newPassword);
    if (samePassword) {
      return authFailures.samePasswordNotAllowed();
    }

    const verifiedCode =
      await this.verificationService.findLatestVerifiedResetCode(emailNormalized);
    if (!verifiedCode) {
      return authFailures.resetRestartRequired();
    }

    const passwordHash = await this.hashPassword(newPassword);
    const databaseNow = await this.prisma.getDatabaseNow();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.verificationCode.updateMany({
        where: { id: verifiedCode.id },
        data: { consumedAt: databaseNow },
      }),
      this.prisma.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: databaseNow },
      }),
    ]);

    return { success: true };
  }

  async logout(token: string | null): Promise<GenericSuccessResult> {
    return this.sessionService.logout(token);
  }

  private async hashPassword(password: string): Promise<string> {
    return argonHash(password, {
      algorithm: 2,
      memoryCost: 8192,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    });
  }
}
