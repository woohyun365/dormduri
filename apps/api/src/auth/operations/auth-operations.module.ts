import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { AuthOperationalCleanupRepository } from './auth-operational-cleanup.repository.js';
import { AuthOperationalCleanupService } from './auth-operational-cleanup.service.js';
import { AuthOperationalMetricsService } from './auth-operational-metrics.service.js';
import { AuthOperationsHealthService } from './auth-operations-health.service.js';

@Module({
  imports: [PrismaModule],
  providers: [
    AuthOperationalCleanupRepository,
    AuthOperationalCleanupService,
    AuthOperationalMetricsService,
    AuthOperationsHealthService,
  ],
  exports: [
    AuthOperationalCleanupService,
    AuthOperationalMetricsService,
    AuthOperationsHealthService,
  ],
})
export class AuthOperationsModule {}
