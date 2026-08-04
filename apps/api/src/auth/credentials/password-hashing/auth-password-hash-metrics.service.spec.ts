import { describe, expect, it, vi } from 'vitest';
import type { DomainMetricsPort } from '../../../platform/observability/metrics/domain-metrics.port.js';
import { AuthPasswordHashMetricsService } from './auth-password-hash-metrics.service.js';

describe('AuthPasswordHashMetricsService', () => {
  it('admission, in-flight, duration을 operation별 bounded metric으로 기록한다', () => {
    const metrics = makeMetrics();
    const service = new AuthPasswordHashMetricsService(metrics);

    service.recordAdmission('login_verify', 'admitted');
    service.recordInFlight('login_verify', 2);
    service.recordOperation('login_verify', 'verify', 0.12);

    expect(metrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_auth_password_hash_admission_total',
      labels: { operation: 'login_verify', outcome: 'admitted' },
    });
    expect(metrics.setGauge).toHaveBeenCalledWith({
      name: 'api_auth_password_hash_in_flight',
      labels: { operation: 'login_verify' },
      value: 2,
    });
    expect(metrics.observeHistogram).toHaveBeenCalledWith({
      name: 'api_auth_password_hash_duration_seconds',
      labels: { operation: 'login_verify', target: 'verify' },
      value: 0.12,
    });
  });
});

function makeMetrics() {
  return {
    incrementCounter: vi.fn(),
    setGauge: vi.fn(),
    observeHistogram: vi.fn(),
  } satisfies DomainMetricsPort;
}
