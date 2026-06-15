import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  DOMAIN_METRICS_PORT,
  recordDomainMetricSafely,
  type DomainMetricsPort,
} from '../../platform/observability/metrics/domain-metrics.port.js';
import { buildRetentionSweepFailureAlert } from './retention-alerts.js';
import { buildRetentionSweepEmission } from './retention-metrics.js';
import type {
  RetentionMetric,
  RetentionObservabilitySweepInput,
  RetentionOperationalAlert,
} from './retention-observability.types.js';

@Injectable()
export class RetentionObservabilityService {
  private readonly logger = new Logger(RetentionObservabilityService.name);

  constructor(
    @Optional()
    @Inject(DOMAIN_METRICS_PORT)
    private readonly domainMetrics?: DomainMetricsPort,
  ) {}

  async emitSweep(input: RetentionObservabilitySweepInput) {
    const emission = await buildRetentionSweepEmission(input);

    for (const metric of emission.metrics) {
      this.logger.log(toMetricLogPayload(metric));
      this.recordRetentionMetric(metric);
    }
    this.recordSweepDuration(input.durationMs, 'success');

    for (const alert of emission.alerts) {
      const payload = toAlertLogPayload(alert);
      if (alert.severity === 'critical') {
        this.logger.error(payload);
      } else {
        this.logger.warn(payload);
      }
    }

    return emission;
  }

  emitSweepFailure(input: { mode: 'periodic' | 'boundary'; error: unknown; occurredAt?: Date }) {
    const alert = buildRetentionSweepFailureAlert(input);
    this.logger.error(toAlertLogPayload(alert));
    this.recordSweepDuration(0, 'failure');
    return alert;
  }

  private recordRetentionMetric(metric: RetentionMetric) {
    const mapped = mapRetentionMetric(metric);
    if (!mapped) {
      return;
    }

    recordDomainMetricSafely(this.domainMetrics, (metrics) => {
      metrics.setGauge({
        name: 'api_retention_backlog_total',
        labels: {
          target: mapped.target,
          state: mapped.state,
        },
        value: metric.value,
      });

      if (mapped.reviewJobOutcome) {
        metrics.incrementCounter({
          name: 'api_retention_review_jobs_total',
          labels: {
            target: mapped.target,
            outcome: mapped.reviewJobOutcome,
          },
          value: metric.value,
        });
      }
    });
  }

  private recordSweepDuration(durationMs: number, outcome: 'success' | 'failure') {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.observeHistogram({
        name: 'api_retention_sweep_duration_seconds',
        labels: { target: 'all', outcome },
        value: Math.max(0, durationMs) / 1000,
      }),
    );
  }
}

function toMetricLogPayload(metric: RetentionMetric) {
  return { event: 'retention.metric', ...metric };
}

function toAlertLogPayload(alert: RetentionOperationalAlert) {
  return { event: 'retention.alert', ...alert };
}

function mapRetentionMetric(metric: RetentionMetric): {
  target: string;
  state: string;
  reviewJobOutcome?: string;
} | null {
  switch (metric.name) {
    case 'retention.archive.jobs.due':
      return { target: 'archive_jobs', state: 'due' };
    case 'retention.archive.jobs.manual_review':
      return { target: 'archive_jobs', state: 'manual_review' };
    case 'retention.archive.jobs.retry_exhausted':
      return { target: 'archive_jobs', state: 'retry_exhausted' };
    case 'retention.review.jobs.due':
      return { target: 'review_jobs', state: 'due', reviewJobOutcome: 'due' };
    case 'retention.review.jobs.manual_review':
      return {
        target: 'review_jobs',
        state: 'manual_review',
        reviewJobOutcome: 'manual_review',
      };
    case 'retention.vault.objects.retained':
      return { target: 'vault_objects', state: 'retained' };
    case 'retention.vault.objects.disposed':
      return { target: 'vault_objects', state: 'disposed' };
    case 'retention.identity.disposal.due':
      return { target: 'identity_disposal', state: 'due' };
    case 'retention.access_log.disposal.due':
      return { target: 'access_log_disposal', state: 'due' };
    case 'retention.access_log.disposed':
      return { target: 'access_log_disposal', state: 'disposed' };
    case 'retention.key.unavailable':
      return { target: 'key', state: 'unavailable' };
    case 'retention.sweep.duration_ms':
      return null;
  }
}
