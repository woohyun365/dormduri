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
import { AuthSecurityEventService } from './auth-security-event.service.js';
import { hasAuthRequestContext, type AuthRequestContext } from './auth-request-context.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationService: AuthVerificationService,
    private readonly sessionService: AuthSessionService,
    private readonly loginAttemptService: AuthLoginAttemptService,
    private readonly moderationService: ModerationService,
    private readonly signupValidationService: AuthSignupValidationService,
    private readonly securityEvents: AuthSecurityEventService,
  ) {}

  async sendSignupCode(
    email: string,
    requestIpOrContext: string | null | AuthRequestContext,
  ): Promise<GenericSuccessResult> {
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
      requestIpOrContext,
    );
  }

  async sendResetCode(
    email: string,
    requestIpOrContext: string | null | AuthRequestContext,
  ): Promise<GenericSuccessResult> {
    const emailNormalized = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
      select: { id: true, deletedAt: true, emailVerifiedAt: true },
    });

    const resetEligible = Boolean(user && !user.deletedAt && user.emailVerifiedAt);
    return this.verificationService.maybeSendResetCode(
      emailNormalized,
      resetEligible,
      requestIpOrContext,
    );
  }

  async verifyEmailCode(
    email: string,
    code: string,
    requestContext: AuthRequestContext = {},
  ): Promise<GenericSuccessResult> {
    if (!hasAuthRequestContext(requestContext)) {
      return this.verificationService.verifyEmailCode(email, code);
    }
    return this.verificationService.verifyEmailCode(email, code, requestContext);
  }

  async verifyResetCode(
    email: string,
    code: string,
    requestContext: AuthRequestContext = {},
  ): Promise<GenericSuccessResult> {
    const emailNormalized = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
      select: { id: true, deletedAt: true, emailVerifiedAt: true },
    });

    if (!user || user.deletedAt || !user.emailVerifiedAt) {
      return authFailures.verificationCodeInvalid();
    }

    if (!hasAuthRequestContext(requestContext)) {
      return this.verificationService.verifyResetCode(email, code);
    }
    return this.verificationService.verifyResetCode(email, code, requestContext);
  }

  async getSession(
    token: string | null,
    requestContext: AuthRequestContext = {},
  ): Promise<SessionStatusResult> {
    if (!hasAuthRequestContext(requestContext)) {
      return this.sessionService.getSession(token);
    }
    return this.sessionService.getSession(token, requestContext);
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

  async login(
    email: string,
    password: string,
    rememberMe: boolean,
    requestContext: AuthRequestContext = {},
  ): Promise<LoginResult> {
    return login(
      {
        prisma: this.prisma,
        loginAttemptService: this.loginAttemptService,
        sessionService: this.sessionService,
        securityEvents: this.securityEvents,
      },
      email,
      password,
      rememberMe,
      hasAuthRequestContext(requestContext) ? requestContext : undefined,
    );
  }

  async resetPassword(
    email: string,
    newPassword: string,
    requestContext: AuthRequestContext = {},
  ): Promise<GenericSuccessResult> {
    return resetPassword(
      {
        prisma: this.prisma,
        verificationService: this.verificationService,
        securityEvents: this.securityEvents,
      },
      email,
      newPassword,
      hasAuthRequestContext(requestContext) ? requestContext : undefined,
    );
  }

  async changePassword(
    authUser: AuthenticatedUserContext,
    currentPassword: string,
    newPassword: string,
    requestContext: AuthRequestContext = {},
  ): Promise<ChangePasswordResult> {
    return changePassword(
      {
        prisma: this.prisma,
        sessionService: this.sessionService,
        securityEvents: this.securityEvents,
      },
      authUser,
      currentPassword,
      newPassword,
      hasAuthRequestContext(requestContext) ? requestContext : undefined,
    );
  }

  async renewSession(
    renewalToken: string | null,
    requestContext: AuthRequestContext = {},
  ): Promise<RenewSessionResult> {
    if (!hasAuthRequestContext(requestContext)) {
      return this.sessionService.renewSession(renewalToken);
    }
    return this.sessionService.renewSession(renewalToken, requestContext);
  }

  async logout(
    token: string | null,
    renewalToken: string | null = null,
    requestContext: AuthRequestContext = {},
  ): Promise<GenericSuccessResult> {
    if (!hasAuthRequestContext(requestContext)) {
      return this.sessionService.logout(token, renewalToken);
    }
    return this.sessionService.logout(token, renewalToken, requestContext);
  }
}
