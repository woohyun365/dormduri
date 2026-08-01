import { describe, expect, it, vi } from 'vitest';
import type { DomainMetricsPort } from '../../platform/observability/metrics/domain-metrics.port.js';
import { AuthFlowMetricsService } from './auth-flow-metrics.service.js';

describe('AuthFlowMetricsService', () => {
  it('verification, credential transition, mail dispatch를 bounded label로 기록한다', () => {
    const metrics = makeMetrics();
    const service = new AuthFlowMetricsService(metrics);

    service.recordVerification('RESET_PASSWORD', 'request', 'accepted');
    service.recordCredentialTransition('reset_password', 'committed');
    service.recordMailDispatch('accepted', 12);

    expect(metrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_auth_verification_operations_total',
      labels: {
        operation: 'request',
        outcome: 'accepted',
        scope: 'reset_password',
      },
    });
    expect(metrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_auth_credential_transitions_total',
      labels: { operation: 'reset_password', outcome: 'committed' },
    });
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
