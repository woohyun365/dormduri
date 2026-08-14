import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  DOMAIN_METRICS_PORT,
  recordDomainMetricSafely,
  type DomainMetricsPort,
} from '../../platform/observability/metrics/domain-metrics.port.js';

@Injectable()
export class AuthMailMetricsService {
  constructor(
    @Optional()
    @Inject(DOMAIN_METRICS_PORT)
    private readonly domainMetrics?: DomainMetricsPort,
  ) {}

  recordDispatch(outcome: string) {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({
        name: 'api_auth_mail_dispatch_total',
        labels: { outcome },
      }),
    );
  }

  recordOutboxLag(lagSeconds: number) {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.setGauge({
        name: 'api_auth_mail_outbox_lag_seconds',
        value: Math.max(0, lagSeconds),
      }),
    );
  }
}
