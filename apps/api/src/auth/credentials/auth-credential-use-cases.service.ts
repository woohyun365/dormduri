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
import { AuthMailOutboxWriter } from '../mail/auth-mail-outbox-writer.service.js';
import { AuthFlowMetricsService } from '../operations/auth-flow-metrics.service.js';
import { ChangePasswordAdmissionService } from './change-password-admission.service.js';

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
    private readonly mailOutboxWriter: AuthMailOutboxWriter,
    private readonly changePasswordAdmission: ChangePasswordAdmissionService,
    private readonly flowMetrics?: AuthFlowMetricsService,
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

  async resetPassword(
    verificationGrant: string | null,
    newPassword: string,
    requestContext: AuthRequestContext = {},
  ): Promise<GenericSuccessResult> {
    try {
      const result = await resetPassword(
        {
          prisma: this.prisma,
          verificationService: this.verificationService,
          loginAttemptService: this.loginAttemptService,
          securityEvents: this.securityEvents,
          mailOutboxWriter: this.mailOutboxWriter,
        },
        verificationGrant,
        newPassword,
        hasAuthRequestContext(requestContext) ? requestContext : undefined,
      );
      this.flowMetrics?.recordCredentialTransition(
        'reset_password',
        result.success ? 'committed' : 'rejected',
      );
      return result;
    } catch (error) {
      this.flowMetrics?.recordCredentialTransition('reset_password', 'failed');
      throw error;
    }
  }

  async changePassword(
    authUser: AuthenticatedUserContext,
    currentPassword: string,
    newPassword: string,
    requestContext: AuthRequestContext = {},
  ): Promise<ChangePasswordResult> {
    try {
      const result = await changePassword(
        {
          prisma: this.prisma,
          sessionService: this.sessionService,
          securityEvents: this.securityEvents,
          mailOutboxWriter: this.mailOutboxWriter,
          admission: this.changePasswordAdmission,
          flowMetrics: this.flowMetrics,
        },
        authUser,
        currentPassword,
        newPassword,
        hasAuthRequestContext(requestContext) ? requestContext : undefined,
      );
      this.flowMetrics?.recordCredentialTransition(
        'change_password',
        result.success ? 'committed' : 'rejected',
      );
      return result;
    } catch (error) {
      this.flowMetrics?.recordCredentialTransition('change_password', 'failed');
      throw error;
    }
  }
}
