import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../common/prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EMAIL_SENDER } from './email-sender.interface.js';
import { StubEmailSenderService } from './stub-email-sender.service.js';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 30,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
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
  exports: [AuthService],
})
export class AuthModule {}
