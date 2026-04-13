import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../common/prisma/prisma.module.js';
import { ModerationModule } from '../common/moderation/moderation.module.js';
import { apiEnv } from '../config/env.js';
import { AuthController } from './auth.controller.js';
import { AuthLoginAttemptService } from './auth-login-attempt.service.js';
import { AuthService } from './auth.service.js';
import { AuthSessionService } from './auth-session.service.js';
import { AuthSignupValidationService } from './auth-signup-validation.service.js';
import { AuthVerificationService } from './auth-verification.service.js';
import { AuthVerificationStore } from './auth-verification.store.js';
import { EMAIL_SENDER } from './email-sender.interface.js';
import { StubEmailSenderService } from './stub-email-sender.service.js';

@Module({
  imports: [
    PrismaModule,
    ModerationModule,
    JwtModule.register({}),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: apiEnv.authThrottleLimit,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthVerificationService,
    AuthVerificationStore,
    AuthSessionService,
    AuthSignupValidationService,
    AuthLoginAttemptService,
    StubEmailSenderService,
    {
      provide: EMAIL_SENDER,
      useExisting: StubEmailSenderService,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [AuthService, AuthSessionService],
})
export class AuthModule {}
