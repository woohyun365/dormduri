import { Module } from '@nestjs/common';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { DomainMetricDefinitionsModule } from '../platform/observability/metrics/domain-metric-definitions.module.js';
import { RETENTION_EXPORTS } from './composition/retention.exports.js';
import { RETENTION_PROVIDERS } from './composition/retention.providers.js';
import { RETENTION_METRIC_DEFINITIONS } from './observability/retention-metric.definitions.js';

@Module({
  imports: [
    PrismaModule,
    DomainMetricDefinitionsModule.register('retention', RETENTION_METRIC_DEFINITIONS),
  ],
  providers: RETENTION_PROVIDERS,
  exports: RETENTION_EXPORTS,
})
export class RetentionModule {}
