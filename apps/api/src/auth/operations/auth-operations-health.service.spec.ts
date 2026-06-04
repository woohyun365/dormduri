import { AuthOperationsHealthService } from './auth-operations-health.service.js';
import { AuthOperationalMetricsService } from './auth-operational-metrics.service.js';

describe('AuthOperationsHealthService', () => {
  it('Redis gate, cleanup lag, RDS pool budget alert를 auth 운영 snapshot으로 노출한다', () => {
    const metrics = new AuthOperationalMetricsService();
    metrics.recordCleanup({
      deletedCounts: {
        expiredSessions: 500,
        verificationCodes: 0,
        verificationRequestLogs: 0,
        loginAttempts: 0,
        securityEvents: 0,
      },
      cleanupLagSeconds: 86_400,
      ranAt: new Date('2026-06-03T00:00:00.000Z'),
    });
    const service = new AuthOperationsHealthService(
      metrics,
      {
        redisTriggerAuthP95Ms: 250,
        redisTriggerAuthWriteIops: 100,
        redisTriggerThrottleBypassPerHour: 1,
        redisDegradeMode: 'postgres-local-fallback-alert',
        cleanupLagAlertSeconds: 86_400,
        rdsPoolUtilizationAlertRatio: 0.8,
      } as never,
      {
        poolMax: 10,
      } as never,
    );

    expect(
      service.getSnapshot({
        redisSignals: {
          authP95Ms: 300,
        },
        rdsPoolUtilizationRatio: 0.81,
      }),
    ).toMatchObject({
      redisGate: {
        decision: 'redis_candidate',
        triggers: ['auth_p95_latency'],
        sourceOfTruth: 'postgres',
      },
      rdsPoolBudget: {
        activeRoles: ['runtime', 'retention_worker', 'retention_disclosure'],
        poolMaxPerRole: 10,
        activePoolMaxConnections: 30,
        migrationConnectionIncludedInAppPool: false,
        alertAtEstimatedConnections: 24,
      },
      alerts: ['auth_cleanup_lag', 'rds_connection_pool_budget', 'auth_redis_gate_triggered'],
    });
  });
});
