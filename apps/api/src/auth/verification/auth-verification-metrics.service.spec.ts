import { describe, expect, it, vi } from 'vitest';
import type { DomainMetricsPort } from '../../platform/observability/metrics/domain-metrics.port.js';
import { AuthVerificationMetricsService } from './auth-verification-metrics.service.js';

describe('AuthVerificationMetricsService', () => {
  it('purpose를 bounded scope로 정규화해 verification metric을 기록한다', () => {
    const metrics = makeMetrics();
    const service = new AuthVerificationMetricsService(metrics);

    service.record('RESET_PASSWORD', 'request', 'accepted');

    expect(metrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_auth_verification_operations_total',
      labels: {
        operation: 'request',
        outcome: 'accepted',
        scope: 'reset_password',
      },
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
