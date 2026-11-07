import { Module } from '@nestjs/common';
import { DomainMetricDefinitionsModule } from '../platform/observability/metrics/domain-metric-definitions.module.js';
import { BACKGROUND_JOB_METRIC_DEFINITIONS } from './background-job-metric.definitions.js';
import { BackgroundJobMetricsService } from './background-job-metrics.service.js';

/**
 * Leaf module for the shared background job metrics. Job owners (lifecycle, auth mail,
 * notifications, chat realtime) import it; it imports no product module, so it cannot
 * form a cycle with LifecycleModule, which imports those owners.
 */
@Module({
  imports: [
    DomainMetricDefinitionsModule.register('background-jobs', BACKGROUND_JOB_METRIC_DEFINITIONS),
  ],
  providers: [BackgroundJobMetricsService],
  exports: [BackgroundJobMetricsService],
})
export class BackgroundJobsModule {}
