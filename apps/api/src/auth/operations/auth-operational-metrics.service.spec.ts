import { describe, expect, it, vi } from 'vitest';
import type { DomainMetricsPort } from '../../platform/observability/metrics/domain-metrics.port.js';
import { AuthOperationalMetricsService } from './auth-operational-metrics.service.js';

describe('AuthOperationalMetricsService', () => {
  it('cleanup lag와 Redis gate snapshot을 no-PII 운영 metric으로 보존한다', () => {
    const domainMetrics = makeDomainMetrics();
    const metrics = new AuthOperationalMetricsService(domainMetrics);
    const now = new Date('2026-06-03T00:00:00.000Z');

    metrics.recordCleanup({
      deletedCounts: {
        expiredSessions: 1,
        verificationCodes: 2,
        verificationRequestLogs: 3,
        loginAttempts: 4,
        securityEvents: 5,
      },
      cleanupLagSeconds: 3600,
      ranAt: now,
    });
    metrics.recordRedisGate({
      decision: 'redis_candidate',
      triggers: ['auth_p95_latency'],
      sourceOfTruth: 'postgres',
      redisOwns: ['distributed_throttle', 'hot_session_cache'],
      redisMustNotOwn: ['session_authority', 'verification_authority', 'account_lockout_authority'],
      degradeMode: 'postgres-local-fallback-alert',
    });
    metrics.recordSecurityAlerts([], 0);

    expect(metrics.snapshot()).toEqual({
      cleanup: {
        totalDeleted: {
          expiredSessions: 1,
          verificationCodes: 2,
          verificationRequestLogs: 3,
          loginAttempts: 4,
          securityEvents: 5,
        },
        lastDeletedCounts: {
          expiredSessions: 1,
          verificationCodes: 2,
          verificationRequestLogs: 3,
          loginAttempts: 4,
          securityEvents: 5,
        },
        lastCleanupLagSeconds: 3600,
        lastRanAt: now.toISOString(),
        lastFailureAt: null,
        totalFailures: 0,
      },
      redisGate: {
        decision: 'redis_candidate',
        triggers: ['auth_p95_latency'],
        sourceOfTruth: 'postgres',
        redisOwns: ['distributed_throttle', 'hot_session_cache'],
        redisMustNotOwn: [
          'session_authority',
          'verification_authority',
          'account_lockout_authority',
        ],
        degradeMode: 'postgres-local-fallback-alert',
      },
      securityAlerts: [],
    });
    expect(domainMetrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_auth_cleanup_deleted_total',
      labels: { target: 'expiredSessions' },
      value: 1,
    });
    expect(domainMetrics.setGauge).toHaveBeenCalledWith({
      name: 'api_auth_cleanup_lag_seconds',
      value: 3600,
    });
    expect(domainMetrics.setGauge).toHaveBeenCalledWith({
      name: 'api_auth_redis_gate_state',
      labels: { state: 'redis_candidate' },
      value: 1,
    });
    expect(JSON.stringify(domainMetrics.incrementCounter.mock.calls)).not.toContain('userId');
    expect(JSON.stringify(domainMetrics.setGauge.mock.calls)).not.toContain('email');
  });

  it('Prometheus bridge 기록 실패는 auth cleanup snapshot 기록을 깨지 않는다', () => {
    const domainMetrics = makeDomainMetrics();
    domainMetrics.incrementCounter.mockImplementation(() => {
      throw new Error('metric rejected');
    });
    const metrics = new AuthOperationalMetricsService(domainMetrics);

    expect(() => metrics.recordCleanupFailure({ now })).not.toThrow();
    expect(metrics.snapshot().cleanup.totalFailures).toBe(1);
  });
});

const now = new Date('2026-06-03T00:00:00.000Z');

function makeDomainMetrics() {
  return {
    incrementCounter: vi.fn(),
    setGauge: vi.fn(),
    observeHistogram: vi.fn(),
  } satisfies DomainMetricsPort;
}
