import { Module } from '@nestjs/common';
import { BackgroundJobsModule } from '../../background-jobs/background-jobs.module.js';
import { MetricsModule } from '../observability/metrics/metrics.module.js';
import { DatabaseTableStatsService } from './database-table-stats.service.js';
import { PrismaModule } from './prisma.module.js';

/**
 * Sits above PrismaModule so Nest stops this reader before the Prisma clients disconnect
 * (test/integration/platform/lifecycle-hook-order.integration.spec.ts).
 */
@Module({
  imports: [PrismaModule, BackgroundJobsModule, MetricsModule],
  providers: [DatabaseTableStatsService],
})
export class DatabaseTableStatsModule {}
