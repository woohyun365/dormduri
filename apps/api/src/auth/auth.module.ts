import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../common/prisma/prisma.module.js';
import { ModerationModule } from '../common/moderation/moderation.module.js';
import authConfig from '../config/auth.config.js';
import { AuthController } from './auth.controller.js';
import { AuthLoginAttemptService } from './auth-login-attempt.service.js';
import { AuthService } from './auth.service.js';
import { AuthSessionService } from './auth-session.service.js';
import { AuthSignupValidationService } from './auth-signup-validation.service.js';
import { AuthVerificationService } from './auth-verification.service.js';
import { AuthVerificationStore } from './auth-verification.store.js';
import { AuthenticatedUserGuard } from './authenticated-user.guard.js';
import { EMAIL_SENDER } from './email-sender.interface.js';
import { AuthSecurityEventService } from './auth-security-event.service.js';
import { AuthSecurityEventRepository } from './repositories/security-event.repository.js';
import { MonitoredEmailSenderService } from './monitored-email-sender.service.js';
import { StubEmailSenderService } from './stub-email-sender.service.js';
import { AuthActorContextResolver } from './application/auth-actor-context.resolver.js';

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
    AuthVerificationStore,
    AuthSessionService,
    AuthSignupValidationService,
    AuthLoginAttemptService,
    AuthSecurityEventService,
    AuthSecurityEventRepository,
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
