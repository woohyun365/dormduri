import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  DOMAIN_METRICS_PORT,
  recordDomainMetricSafely,
  type DomainMetricsPort,
} from '../../platform/observability/metrics/domain-metrics.port.js';

export type AuthSessionRenewalOutcome = 'renewed' | 'required' | 'reused' | 'stale';

@Injectable()
export class AuthSessionMetricsService {
  constructor(
    @Optional()
    @Inject(DOMAIN_METRICS_PORT)
    private readonly domainMetrics?: DomainMetricsPort,
  ) {}

  recordRenewal(outcome: AuthSessionRenewalOutcome): void {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({
        name: 'api_auth_session_renewals_total',
        labels: { outcome },
      }),
    );
  }
}
