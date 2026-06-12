import { describe, expect, it } from 'vitest';
import { AuthOperationalMetricsService } from './auth-operational-metrics.service.js';

describe('AuthOperationalMetricsService', () => {
  it('cleanup lag와 Redis gate snapshot을 no-PII 운영 metric으로 보존한다', () => {
    const metrics = new AuthOperationalMetricsService();
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
    });
  });
});
