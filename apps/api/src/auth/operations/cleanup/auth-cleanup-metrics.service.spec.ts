import { describe, expect, it, vi } from 'vitest';
import type { DomainMetricsPort } from '../../../platform/observability/metrics/domain-metrics.port.js';
import { AuthCleanupMetricsService } from './auth-cleanup-metrics.service.js';

describe('AuthCleanupMetricsService', () => {
  it('cleanup 삭제량과 target별 batch 포화를 no-PII 운영 metric으로 보존한다', () => {
    const domainMetrics = makeDomainMetrics();
    const metrics = new AuthCleanupMetricsService(domainMetrics);
    metrics.recordCleanup({
      deletedCounts: {
        expiredSessions: 1,
        verificationCodes: 2,
        verificationRequestLogs: 3,
        loginAttempts: 4,
        securityEvents: 5,
      },
      batchSaturatedTargets: ['verificationCodes', 'securityEvents'],
    });
    expect(domainMetrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_auth_cleanup_deleted_total',
      labels: { target: 'expired_sessions' },
      value: 1,
    });
    expect(domainMetrics.setGauge).toHaveBeenCalledWith({
      name: 'api_auth_cleanup_batch_saturated',
      labels: { target: 'verification_codes' },
      value: 1,
    });
    expect(domainMetrics.setGauge).toHaveBeenCalledWith({
      name: 'api_auth_cleanup_batch_saturated',
      labels: { target: 'expired_sessions' },
      value: 0,
    });
    expect(JSON.stringify(domainMetrics.incrementCounter.mock.calls)).not.toContain('userId');
    expect(JSON.stringify(domainMetrics.setGauge.mock.calls)).not.toContain('email');
  });

  it('Prometheus bridge 기록 실패는 auth cleanup을 깨지 않는다', () => {
    const domainMetrics = makeDomainMetrics();
    domainMetrics.incrementCounter.mockImplementation(() => {
      throw new Error('metric rejected');
    });
    const metrics = new AuthCleanupMetricsService(domainMetrics);

    expect(() => metrics.recordCleanupFailure()).not.toThrow();
  });
});

function makeDomainMetrics() {
  return {
    incrementCounter: vi.fn(),
    setGauge: vi.fn(),
    observeHistogram: vi.fn(),
  } satisfies DomainMetricsPort;
}
