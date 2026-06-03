import { Injectable } from '@nestjs/common';
import type {
  GenericSuccessResult,
  ChangePasswordResult,
  LoginResult,
  RenewSessionResult,
  SessionStatusResult,
  SignupInput,
} from './auth.types.js';
import { isKnuEmail, normalizeEmail } from './auth.utils.js';
import { AuthVerificationService } from './auth-verification.service.js';
import { AuthSessionService } from './auth-session.service.js';
import { AuthLoginAttemptService } from './auth-login-attempt.service.js';
import { ModerationService } from '../common/moderation/moderation.service.js';
import { AuthSignupValidationService } from './auth-signup-validation.service.js';
import type { SignupDraftValidationResponse } from '@repo/shared/auth-response';
import { authFailures } from './auth-failures.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { signup } from './auth-signup-owner.js';
import { login } from './auth-login-owner.js';
import { resetPassword } from './auth-reset-password-owner.js';
import { changePassword } from './auth-change-password-owner.js';
import type { AuthenticatedUserContext } from './auth-session.service.js';

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
      select: { id: true, deletedAt: true, emailVerifiedAt: true },
    });

    const resetEligible = Boolean(user && !user.deletedAt && user.emailVerifiedAt);
    return this.verificationService.maybeSendResetCode(emailNormalized, resetEligible, requestIp);
  }

  async verifyEmailCode(email: string, code: string): Promise<GenericSuccessResult> {
    return this.verificationService.verifyEmailCode(email, code);
  }

  async verifyResetCode(email: string, code: string): Promise<GenericSuccessResult> {
    const emailNormalized = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
      select: { id: true, deletedAt: true, emailVerifiedAt: true },
    });

    if (!user || user.deletedAt || !user.emailVerifiedAt) {
      return authFailures.verificationCodeInvalid();
    }

    return this.verificationService.verifyResetCode(email, code);
  }

  async getSession(token: string | null): Promise<SessionStatusResult> {
    return this.sessionService.getSession(token);
  }

  async validateSignupDraft(input: {
    email: string;
    password: string;
    nickname: string;
  }): Promise<SignupDraftValidationResponse> {
    return this.signupValidationService.validateDraft(input);
  }

  async signup(input: SignupInput): Promise<LoginResult> {
    return signup(
      {
        prisma: this.prisma,
        verificationService: this.verificationService,
        sessionService: this.sessionService,
        signupValidationService: this.signupValidationService,
      },
      input,
    );
  }

  async login(email: string, password: string, rememberMe: boolean): Promise<LoginResult> {
    return login(
      {
        prisma: this.prisma,
        loginAttemptService: this.loginAttemptService,
        sessionService: this.sessionService,
      },
      email,
      password,
      rememberMe,
    );
  }

  async resetPassword(email: string, newPassword: string): Promise<GenericSuccessResult> {
    return resetPassword(
      {
        prisma: this.prisma,
        verificationService: this.verificationService,
      },
      email,
      newPassword,
    );
  }

  async changePassword(
    authUser: AuthenticatedUserContext,
    currentPassword: string,
    newPassword: string,
  ): Promise<ChangePasswordResult> {
    return changePassword(
      {
        prisma: this.prisma,
        sessionService: this.sessionService,
      },
      authUser,
      currentPassword,
      newPassword,
    );
  }

  async renewSession(renewalToken: string | null): Promise<RenewSessionResult> {
    return this.sessionService.renewSession(renewalToken);
  }

  async logout(
    token: string | null,
    renewalToken: string | null = null,
  ): Promise<GenericSuccessResult> {
    return this.sessionService.logout(token, renewalToken);
  }
}
