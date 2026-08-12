import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DomainMetricDefinitionsModule } from '../platform/observability/metrics/domain-metric-definitions.module.js';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { DisplayIdentityModule } from '../users/identity/display/display-identity.module.js';
import authConfig from './config/auth.config.js';
import { AuthController } from './auth.controller.js';
import { AUTH_EXPORTS } from './composition/auth.exports.js';
import { AUTH_PROVIDERS } from './composition/auth.providers.js';
import { buildAuthThrottlerOptions } from './login-attempts/network-throttle/auth-throttle.options.js';
import { AUTH_METRIC_DEFINITIONS } from './observability/auth-metric.definitions.js';

@Module({
  imports: [
    PrismaModule,
    DisplayIdentityModule,
    DomainMetricDefinitionsModule.register('auth', AUTH_METRIC_DEFINITIONS),
    ThrottlerModule.forRootAsync({
      inject: [authConfig.KEY],
      useFactory: (config: ConfigType<typeof authConfig>) => buildAuthThrottlerOptions(config),
    }),
  ],
  controllers: [AuthController],
  providers: AUTH_PROVIDERS,
  exports: AUTH_EXPORTS,
})
export class AuthModule {}
