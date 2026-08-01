import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { MetricsModule } from '../../platform/observability/metrics/metrics.module.js';
import { AuthOperationalCleanupRepository } from './auth-operational-cleanup.repository.js';
import { AuthOperationalCleanupService } from './auth-operational-cleanup.service.js';
import { AuthOperationalMetricsService } from './auth-operational-metrics.service.js';
import { AuthOperationsHealthService } from './auth-operations-health.service.js';
import { AuthSecurityAlertRepository } from './auth-security-alert.repository.js';

@Module({
  imports: [PrismaModule, MetricsModule],
  providers: [
    AuthOperationalCleanupRepository,
    AuthOperationalCleanupService,
    AuthOperationalMetricsService,
    AuthOperationsHealthService,
    AuthSecurityAlertRepository,
  ],
  exports: [
    AuthOperationalCleanupService,
    AuthOperationalMetricsService,
    AuthOperationsHealthService,
  ],
})
export class AuthOperationsModule {}
