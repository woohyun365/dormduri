import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  DOMAIN_METRICS_PORT,
  recordDomainMetricSafely,
  type DomainMetricsPort,
} from '../platform/observability/metrics/domain-metrics.port.js';
import { AppLoggerService } from '../platform/observability/logging/app-logger.service.js';
import type { HealthReadinessCheckResult } from './checks/health-check.types.js';

@Injectable()
export class HealthObservabilityService {
  private lastLoggedOutcome: 'success' | 'failure' | null = null;

  constructor(
    private readonly logger: AppLoggerService,
    @Optional()
    @Inject(DOMAIN_METRICS_PORT)
    private readonly metrics?: DomainMetricsPort,
  ) {}

  recordReadiness(checks: readonly HealthReadinessCheckResult[], durationMs: number): void {
    const failures = checks.filter((check) => check.status === 'down');
    const outcome = failures.length === 0 ? 'success' : 'failure';

    recordDomainMetricSafely(this.metrics, (metrics) => {
      metrics.incrementCounter({
        name: 'api_health_readiness_total',
        labels: { outcome },
      });
      for (const failure of failures) {
        metrics.incrementCounter({
          name: 'api_health_readiness_failures_total',
          labels: { reason: failure.code },
        });
      }
      metrics.observeHistogram({
        name: 'api_health_readiness_duration_seconds',
        labels: { outcome },
        value: durationMs / 1_000,
      });
    });

    if (this.lastLoggedOutcome === outcome) {
      return;
    }

    this.lastLoggedOutcome = outcome;
    this.logger.write(
      outcome === 'success' ? 'info' : 'warn',
      {
        domain: 'platform',
        durationMs,
        errorCode: failures[0]?.code,
        operation: 'health_readiness',
        outcome,
      },
      'API readiness state changed',
    );
  }
}
