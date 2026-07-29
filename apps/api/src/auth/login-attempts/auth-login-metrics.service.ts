import { Inject, Injectable, Optional } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import {
  DOMAIN_METRICS_PORT,
  recordDomainMetricSafely,
  type DomainMetricsPort,
} from '../../platform/observability/metrics/domain-metrics.port.js';

export type AuthLoginAttemptOutcome = 'invalid' | 'locked' | 'success';
export type AuthLoginThrottleScope = 'ip_burst' | 'ip_sustained';
export type AuthPasswordVerifyTarget = 'dummy' | 'real';

@Injectable()
export class AuthLoginMetricsService {
  private readonly passwordVerifyInFlight: Record<AuthPasswordVerifyTarget, number> = {
    dummy: 0,
    real: 0,
  };

  constructor(
    @Optional()
    @Inject(DOMAIN_METRICS_PORT)
    private readonly domainMetrics?: DomainMetricsPort,
  ) {}

  recordAttempt(outcome: AuthLoginAttemptOutcome): void {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({
        name: 'api_auth_login_attempts_total',
        labels: { outcome },
      }),
    );
  }

  recordThrottle(scope: AuthLoginThrottleScope): void {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({
        name: 'api_auth_login_throttle_total',
        labels: { scope },
      }),
    );
  }

  startPasswordVerify(target: AuthPasswordVerifyTarget): () => void {
    const startedAt = performance.now();
    this.passwordVerifyInFlight[target] += 1;
    this.recordPasswordVerifyInFlight(target);
    let completed = false;

    return () => {
      if (completed) {
        return;
      }
      completed = true;
      this.passwordVerifyInFlight[target] = Math.max(0, this.passwordVerifyInFlight[target] - 1);
      this.recordPasswordVerifyInFlight(target);
      recordDomainMetricSafely(this.domainMetrics, (metrics) =>
        metrics.observeHistogram({
          name: 'api_auth_login_password_verify_duration_seconds',
          labels: { target },
          value: Math.max(0, performance.now() - startedAt) / 1_000,
        }),
      );
    };
  }

  private recordPasswordVerifyInFlight(target: AuthPasswordVerifyTarget): void {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.setGauge({
        name: 'api_auth_login_password_verify_in_flight',
        labels: { target },
        value: this.passwordVerifyInFlight[target],
      }),
    );
  }
}
