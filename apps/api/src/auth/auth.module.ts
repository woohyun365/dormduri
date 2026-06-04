import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../common/prisma/prisma.module.js';
import { ModerationModule } from '../common/moderation/moderation.module.js';
import authConfig from '../config/auth.config.js';
import { AuthController } from './auth.controller.js';
import { AuthLoginAttemptService } from './login-attempts/auth-login-attempt.service.js';
import { ClearLoginFailuresCommand } from './login-attempts/clear-login-failures.command.js';
import { GetActiveLoginLockQuery } from './login-attempts/get-active-login-lock.query.js';
import { LoginAttemptRepository } from './login-attempts/login-attempt.repository.js';
import { RecordLoginFailureCommand } from './login-attempts/record-login-failure.command.js';
import { AuthService } from './auth.service.js';
import { AuthSessionService } from './auth-session.service.js';
import { AuthSignupValidationService } from './registration/auth-signup-validation.service.js';
import { AuthVerificationService } from './verification/auth-verification.service.js';
import { AuthVerificationEligibilityQuery } from './verification/auth-verification-eligibility.query.js';
import { AuthVerificationStore } from './verification/verification-code.repository.js';
import { AuthenticatedUserGuard } from './authenticated-user.guard.js';
import { EMAIL_SENDER } from './email-sender.interface.js';
import { AuthSecurityEventRepository } from './security-events/auth-security-event.repository.js';
import { AuthSecurityEventService } from './security-events/auth-security-event.service.js';
import { MonitoredEmailSenderService } from './monitored-email-sender.service.js';
import { StubEmailSenderService } from './stub-email-sender.service.js';
import { AuthActorContextResolver } from './application/auth-actor-context.resolver.js';
import { AuthSessionRepository } from './sessions/auth-session.repository.js';
import { CurrentSessionQuery } from './sessions/current-session.query.js';
import { IssueSessionCommand } from './sessions/issue-session.command.js';
import { LogoutSessionCommand } from './sessions/logout-session.command.js';
import { RenewSessionCommand } from './sessions/renew-session.command.js';
import { RevokeSessionsCommand } from './sessions/revoke-sessions.command.js';

@Module({
  imports: [
    PrismaModule,
    ModerationModule,
    ThrottlerModule.forRootAsync({
      inject: [authConfig.KEY],
      useFactory: (config: ConfigType<typeof authConfig>) => [
        {
          ttl: 60_000,
          limit: config.authThrottleLimit,
        },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthVerificationService,
    AuthVerificationEligibilityQuery,
    AuthVerificationStore,
    AuthSessionService,
    AuthSignupValidationService,
    AuthLoginAttemptService,
    LoginAttemptRepository,
    GetActiveLoginLockQuery,
    RecordLoginFailureCommand,
    ClearLoginFailuresCommand,
    AuthSecurityEventService,
    AuthSecurityEventRepository,
    AuthSessionRepository,
    CurrentSessionQuery,
    IssueSessionCommand,
    RenewSessionCommand,
    RevokeSessionsCommand,
    LogoutSessionCommand,
    AuthActorContextResolver,
    AuthenticatedUserGuard,
    StubEmailSenderService,
    MonitoredEmailSenderService,
    {
      provide: EMAIL_SENDER,
      useExisting: MonitoredEmailSenderService,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthenticatedUserGuard,
    },
  ],
  exports: [AuthService, AuthSessionService, AuthActorContextResolver, AuthenticatedUserGuard],
})
export class AuthModule {}
