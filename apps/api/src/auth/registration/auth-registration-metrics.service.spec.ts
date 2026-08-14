import { describe, expect, it, vi } from 'vitest';
import type { DomainMetricsPort } from '../../platform/observability/metrics/domain-metrics.port.js';
import { AuthRegistrationMetricsService } from './auth-registration-metrics.service.js';

describe('AuthRegistrationMetricsService', () => {
  it('nickname, final admission, password hash를 signup owner metric으로 기록한다', () => {
    const metrics = makeMetrics();
    const service = new AuthRegistrationMetricsService(metrics);

    service.recordNicknameValidation('available');
    service.recordFinalAdmission('allowed');
    service.recordPasswordHash('completed', 0.2);

    expect(metrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_auth_signup_nickname_validation_total',
      labels: { outcome: 'available' },
    });
    expect(metrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_auth_signup_final_admission_total',
      labels: { outcome: 'allowed' },
    });
    expect(metrics.observeHistogram).toHaveBeenCalledWith({
      name: 'api_auth_signup_password_hash_duration_seconds',
      labels: { outcome: 'completed' },
      value: 0.2,
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
