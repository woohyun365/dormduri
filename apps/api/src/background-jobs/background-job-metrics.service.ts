import { Inject, Injectable } from '@nestjs/common';
import {
  DOMAIN_METRICS_PORT,
  recordDomainMetricSafely,
  type DomainMetricsPort,
} from '../platform/observability/metrics/domain-metrics.port.js';

/** Bounded job label values; never user, thread or error text. */
export type BackgroundJobName =
  | 'lifecycle_sweep'
  | 'auth_mail_dispatcher'
  | 'notification_dispatcher'
  | 'chat_realtime_dispatcher';

/** A tick returns `skipped` when it did no work on purpose (already running, publisher unbound). */
export type BackgroundJobTickOutcome = 'succeeded' | 'skipped';

@Injectable()
export class BackgroundJobMetricsService {
  constructor(
    @Inject(DOMAIN_METRICS_PORT)
    private readonly domainMetrics: DomainMetricsPort,
  ) {}

  recordSucceeded(job: BackgroundJobName, at: Date = new Date()): void {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.setGauge({
        name: 'api_background_job_last_success_timestamp_seconds',
        labels: { job },
        value: Math.floor(at.getTime() / 1_000),
      }),
    );
  }

  recordFailed(job: BackgroundJobName): void {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({
        name: 'api_background_job_failures_total',
        labels: { job },
      }),
    );
  }
}

/**
 * Runs one scheduled tick and records its outcome: success sets the last success time,
 * a thrown error counts one failure and is rethrown to the caller's own log, a skipped
 * tick records nothing. Without the metrics service (unit wiring) it only runs the tick.
 */
export async function runBackgroundJobTick(
  metrics: BackgroundJobMetricsService | undefined,
  job: BackgroundJobName,
  tick: () => Promise<BackgroundJobTickOutcome>,
): Promise<void> {
  let outcome: BackgroundJobTickOutcome;
  try {
    outcome = await tick();
  } catch (error) {
    metrics?.recordFailed(job);
    throw error;
  }
  if (outcome === 'succeeded') {
    metrics?.recordSucceeded(job);
  }
}
