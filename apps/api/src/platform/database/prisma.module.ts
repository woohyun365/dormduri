import { Module } from '@nestjs/common';
import {
  PrismaService,
  RetentionDisclosurePrismaService,
  RetentionWorkerPrismaService,
} from './prisma.service.js';
import { AppLoggerModule } from '../observability/logging/app-logger.module.js';
import { DomainMetricDefinitionsModule } from '../observability/metrics/domain-metric-definitions.module.js';
import { PRISMA_METRIC_DEFINITIONS } from './prisma-metric.definitions.js';

@Module({
  imports: [
    AppLoggerModule,
    DomainMetricDefinitionsModule.register('platform/database', PRISMA_METRIC_DEFINITIONS),
  ],
  providers: [PrismaService, RetentionWorkerPrismaService, RetentionDisclosurePrismaService],
  exports: [PrismaService, RetentionWorkerPrismaService, RetentionDisclosurePrismaService],
})
export class PrismaModule {}
