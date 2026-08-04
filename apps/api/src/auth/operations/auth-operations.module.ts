import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { MetricsModule } from '../../platform/observability/metrics/metrics.module.js';
import { AuthOperationalCleanupRepository } from './cleanup/auth-operational-cleanup.repository.js';
import { AuthOperationalCleanupService } from './cleanup/auth-operational-cleanup.service.js';
import { AuthCleanupMetricsService } from './cleanup/auth-cleanup-metrics.service.js';
import { AuthOperationsHealthService } from './health/auth-operations-health.service.js';

@Module({
  imports: [PrismaModule, MetricsModule],
  providers: [
    AuthOperationalCleanupRepository,
    AuthOperationalCleanupService,
    AuthCleanupMetricsService,
    AuthOperationsHealthService,
  ],
  exports: [AuthOperationalCleanupService, AuthOperationsHealthService],
})
export class AuthOperationsModule {}
