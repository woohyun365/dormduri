import { describe, expect, it } from 'vitest';
import { AuthOperationsHealthService } from './auth-operations-health.service.js';
import { AuthCleanupMetricsService } from '../cleanup/auth-cleanup-metrics.service.js';

describe('AuthOperationsHealthService', () => {
  it('경고 판정 없이 cleanup 운영 상태만 노출한다', () => {
    const metrics = new AuthCleanupMetricsService();
    metrics.recordCleanup({
      deletedCounts: {
        expiredSessions: 500,
        verificationCodes: 0,
        verificationRequestLogs: 0,
        loginAttempts: 0,
        securityEvents: 0,
      },
      batchSaturatedTargets: ['expiredSessions'],
      ranAt: new Date('2026-06-03T00:00:00.000Z'),
    });
    const service = new AuthOperationsHealthService(metrics);

    expect(service.getSnapshot()).toMatchObject({
      cleanup: {
        lastBatchSaturatedTargets: ['expiredSessions'],
      },
    });
  });
});
