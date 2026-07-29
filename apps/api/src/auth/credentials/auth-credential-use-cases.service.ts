import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/database/prisma.service.js';
import type {
  ChangePasswordResult,
  GenericSuccessResult,
  LoginResult,
} from '../domain/auth.types.js';
import { hasAuthRequestContext, type AuthRequestContext } from '../domain/auth-request-context.js';
import type { AuthenticatedUserContext } from '../sessions/auth-session.service.js';
import { AuthSessionService } from '../sessions/auth-session.service.js';
import { AuthLoginAttemptService } from '../login-attempts/auth-login-attempt.service.js';
import { AuthLoginMetricsService } from '../login-attempts/auth-login-metrics.service.js';
import { AuthSecurityEventService } from '../security-events/auth-security-event.service.js';
import { AuthVerificationService } from '../verification/auth-verification.service.js';
import { changePassword } from './change-password.command.js';
import { AuthPasswordHashPolicy } from './auth-password-hash.adapter.js';
import { login } from './login.command.js';
import { resetPassword } from './reset-password.command.js';

@Injectable()
export class AuthCredentialUseCases {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loginAttemptService: AuthLoginAttemptService,
    private readonly loginMetrics: AuthLoginMetricsService,
    private readonly passwordHashPolicy: AuthPasswordHashPolicy,
    private readonly sessionService: AuthSessionService,
    private readonly verificationService: AuthVerificationService,
    private readonly securityEvents: AuthSecurityEventService,
  ) {}

  login(
    email: string,
    password: string,
    rememberMe: boolean,
    requestContext: AuthRequestContext = {},
  ): Promise<LoginResult> {
    return login(
      {
        prisma: this.prisma,
        loginAttemptService: this.loginAttemptService,
        loginMetrics: this.loginMetrics,
        passwordHashPolicy: this.passwordHashPolicy,
        sessionService: this.sessionService,
        securityEvents: this.securityEvents,
      },
      email,
      password,
      rememberMe,
      hasAuthRequestContext(requestContext) ? requestContext : undefined,
    );
  }

  resetPassword(
    email: string,
    newPassword: string,
    requestContext: AuthRequestContext = {},
  ): Promise<GenericSuccessResult> {
    return resetPassword(
      {
        prisma: this.prisma,
        verificationService: this.verificationService,
        loginAttemptService: this.loginAttemptService,
        securityEvents: this.securityEvents,
      },
      email,
      newPassword,
      hasAuthRequestContext(requestContext) ? requestContext : undefined,
    );
  }

  changePassword(
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
}
