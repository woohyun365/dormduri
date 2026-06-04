import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { ModerationModule } from '../common/moderation/moderation.module.js';
import authConfig from '../config/auth.config.js';
import { AuthController } from './auth.controller.js';
import { AUTH_EXPORTS } from './composition/auth.exports.js';
import { AUTH_PROVIDERS } from './composition/auth.providers.js';

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
  providers: AUTH_PROVIDERS,
  exports: AUTH_EXPORTS,
})
export class AuthModule {}
