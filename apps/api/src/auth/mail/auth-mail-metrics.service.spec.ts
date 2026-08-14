import { describe, expect, it, vi } from 'vitest';
import type { DomainMetricsPort } from '../../platform/observability/metrics/domain-metrics.port.js';
import { AuthMailMetricsService } from './auth-mail-metrics.service.js';

describe('AuthMailMetricsService', () => {
  it('dispatch outcome과 outbox lag을 mail lifecycle metric으로 기록한다', () => {
    const metrics = makeMetrics();
    const service = new AuthMailMetricsService(metrics);

    service.recordDispatch('accepted');
    service.recordOutboxLag(12);

    expect(metrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_auth_mail_dispatch_total',
      labels: { outcome: 'accepted' },
    });
    expect(metrics.setGauge).toHaveBeenCalledWith({
      name: 'api_auth_mail_outbox_lag_seconds',
      value: 12,
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
