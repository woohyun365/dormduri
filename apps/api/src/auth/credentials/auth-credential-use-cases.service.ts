import { Injectable } from '@nestjs/common';
import type {
  ChangePasswordResponse,
  GenericErrorResponse,
  LoginResponse,
} from '@repo/shared/auth/response';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { hasAuthRequestContext, type AuthRequestContext } from '../domain/auth-request-context.js';
import type { AuthenticatedUserContext } from '../sessions/auth-session.service.js';
import { AuthSessionService } from '../sessions/auth-session.service.js';
import { AuthLoginAttemptService } from '../login-attempts/account-lock/auth-login-attempt.service.js';
import { AuthLoginMetricsService } from '../login-attempts/auth-login-metrics.service.js';
import { AuthSecurityEventService } from '../security-events/auth-security-event.service.js';
import { AuthVerificationService } from '../verification/auth-verification.service.js';
import { changePassword } from './change-password.command.js';
import { AuthPasswordHashPolicy } from './password-hashing/auth-password-hash.adapter.js';
import { login } from './login.command.js';
import { resetPassword } from './reset-password.command.js';
import { AuthMailOutboxWriter } from '../mail/auth-mail-outbox-writer.service.js';
import { AuthCredentialMetricsService } from './auth-credential-metrics.service.js';
import { ChangePasswordAdmissionService } from './change-password-admission.service.js';
import { AuthPasswordPolicyService } from './password-policy/auth-password-policy.service.js';

@Injectable()
export class AuthCredentialUseCases {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loginAttemptService: AuthLoginAttemptService,
    private readonly loginMetrics: AuthLoginMetricsService,
    private readonly passwordHashPolicy: AuthPasswordHashPolicy,
    private readonly passwordPolicy: AuthPasswordPolicyService,
    private readonly sessionService: AuthSessionService,
    private readonly verificationService: AuthVerificationService,
    private readonly securityEvents: AuthSecurityEventService,
    private readonly mailOutboxWriter: AuthMailOutboxWriter,
    private readonly changePasswordAdmission: ChangePasswordAdmissionService,
    private readonly credentialMetrics?: AuthCredentialMetricsService,
  ) {}

  login(
    email: string,
    password: string,
    rememberMe: boolean,
    requestContext: AuthRequestContext = {},
  ): Promise<LoginResponse> {
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

  async resetPassword(
    verificationGrant: string | null,
    newPassword: string,
    requestContext: AuthRequestContext = {},
  ): Promise<GenericErrorResponse> {
    try {
      const result = await resetPassword(
        {
          prisma: this.prisma,
          verificationService: this.verificationService,
          passwordPolicy: this.passwordPolicy,
          loginAttemptService: this.loginAttemptService,
          securityEvents: this.securityEvents,
          mailOutboxWriter: this.mailOutboxWriter,
          metrics: this.credentialMetrics,
        },
        verificationGrant,
        newPassword,
        hasAuthRequestContext(requestContext) ? requestContext : undefined,
      );
      this.credentialMetrics?.recordTransition(
        'reset_password',
        result.success ? 'committed' : 'rejected',
      );
      return result;
    } catch (error) {
      this.credentialMetrics?.recordTransition('reset_password', 'failed');
      throw error;
    }
  }

  async changePassword(
    authUser: AuthenticatedUserContext,
    currentPassword: string,
    newPassword: string,
    requestContext: AuthRequestContext = {},
  ): Promise<ChangePasswordResponse> {
    try {
      const result = await changePassword(
        {
          prisma: this.prisma,
          sessionService: this.sessionService,
          securityEvents: this.securityEvents,
          mailOutboxWriter: this.mailOutboxWriter,
          admission: this.changePasswordAdmission,
          passwordPolicy: this.passwordPolicy,
          metrics: this.credentialMetrics,
        },
        authUser,
        currentPassword,
        newPassword,
        hasAuthRequestContext(requestContext) ? requestContext : undefined,
      );
      this.credentialMetrics?.recordTransition(
        'change_password',
        result.success ? 'committed' : 'rejected',
      );
      return result;
    } catch (error) {
      this.credentialMetrics?.recordTransition('change_password', 'failed');
      throw error;
    }
  }
}
