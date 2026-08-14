import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  DOMAIN_METRICS_PORT,
  recordDomainMetricSafely,
  type DomainMetricsPort,
} from '../../../platform/observability/metrics/domain-metrics.port.js';
import type {
  AuthPasswordHashOperation,
  AuthPasswordHashTarget,
} from './password-hash-admission.service.js';

export type AuthPasswordHashAdmissionMetricOutcome =
  | 'admitted'
  | 'queue_full'
  | 'queued'
  | 'timed_out';

@Injectable()
export class AuthPasswordHashMetricsService {
  constructor(
    @Optional()
    @Inject(DOMAIN_METRICS_PORT)
    private readonly domainMetrics?: DomainMetricsPort,
  ) {}

  recordAdmission(
    operation: AuthPasswordHashOperation,
    outcome: AuthPasswordHashAdmissionMetricOutcome,
  ) {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({
        name: 'api_auth_password_hash_admission_total',
        labels: { operation, outcome },
      }),
    );
  }

  recordInFlight(operation: AuthPasswordHashOperation, value: number) {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.setGauge({
        name: 'api_auth_password_hash_in_flight',
        labels: { operation },
        value: Math.max(0, value),
      }),
    );
  }

  recordOperation(
    operation: AuthPasswordHashOperation,
    target: AuthPasswordHashTarget,
    durationSeconds: number,
  ) {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.observeHistogram({
        name: 'api_auth_password_hash_duration_seconds',
        labels: { operation, target },
        value: Math.max(0, durationSeconds),
      }),
    );
  }
}
