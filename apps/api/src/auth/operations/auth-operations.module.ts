import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { DomainMetricDefinitionsModule } from '../../platform/observability/metrics/domain-metric-definitions.module.js';
import { AuthOperationalCleanupRepository } from './cleanup/auth-operational-cleanup.repository.js';
import { AuthOperationalCleanupService } from './cleanup/auth-operational-cleanup.service.js';
import { AuthCleanupMetricsService } from './cleanup/auth-cleanup-metrics.service.js';
import { AUTH_CLEANUP_METRIC_DEFINITIONS } from './cleanup/auth-cleanup-metric.definitions.js';

@Module({
  imports: [
    PrismaModule,
    DomainMetricDefinitionsModule.register('auth/operations', AUTH_CLEANUP_METRIC_DEFINITIONS),
  ],
  providers: [
    AuthOperationalCleanupRepository,
    AuthOperationalCleanupService,
    AuthCleanupMetricsService,
  ],
  exports: [AuthOperationalCleanupService],
})
export class AuthOperationsModule {}
