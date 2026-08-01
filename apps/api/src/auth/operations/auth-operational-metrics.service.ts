import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  DOMAIN_METRICS_PORT,
  recordDomainMetricSafely,
  type DomainMetricsPort,
} from '../../platform/observability/metrics/domain-metrics.port.js';
import type { AuthRedisGateEvaluation } from './auth-redis-gate.policy.js';
import {
  AUTH_SECURITY_ALERT_KINDS,
  type AuthSecurityAlert,
} from '../security-events/security-alert.policy.js';

export interface AuthCleanupMetricsInput {
  deletedCounts: AuthCleanupDeletedCounts;
  cleanupLagSeconds: number;
  ranAt: Date;
}

export interface AuthCleanupDeletedCounts {
  expiredSessions: number;
  verificationCodes: number;
  verificationRequestLogs: number;
  loginAttempts: number;
  securityEvents: number;
}

export interface AuthOperationsMetricsSnapshot {
  cleanup: {
    totalDeleted: AuthCleanupDeletedCounts;
    lastDeletedCounts: AuthCleanupDeletedCounts;
    lastCleanupLagSeconds: number;
    lastRanAt: string | null;
    lastFailureAt: string | null;
    totalFailures: number;
  };
  redisGate: AuthRedisGateEvaluation | null;
  securityAlerts: AuthSecurityAlert[];
}

function emptyDeletedCounts(): AuthCleanupDeletedCounts {
  return {
    expiredSessions: 0,
    verificationCodes: 0,
    verificationRequestLogs: 0,
    loginAttempts: 0,
    securityEvents: 0,
  };
}

function addDeletedCounts(
  left: AuthCleanupDeletedCounts,
  right: AuthCleanupDeletedCounts,
): AuthCleanupDeletedCounts {
  return {
    expiredSessions: left.expiredSessions + right.expiredSessions,
    verificationCodes: left.verificationCodes + right.verificationCodes,
    verificationRequestLogs: left.verificationRequestLogs + right.verificationRequestLogs,
    loginAttempts: left.loginAttempts + right.loginAttempts,
    securityEvents: left.securityEvents + right.securityEvents,
  };
}

@Injectable()
export class AuthOperationalMetricsService {
  constructor(
    @Optional()
    @Inject(DOMAIN_METRICS_PORT)
    private readonly domainMetrics?: DomainMetricsPort,
  ) {}

  private totalDeleted = emptyDeletedCounts();
  private lastDeletedCounts = emptyDeletedCounts();
  private lastCleanupLagSeconds = 0;
  private lastRanAt: string | null = null;
  private lastFailureAt: string | null = null;
  private totalFailures = 0;
  private redisGate: AuthRedisGateEvaluation | null = null;
  private securityAlerts: AuthSecurityAlert[] = [];

  recordCleanup(input: AuthCleanupMetricsInput) {
    this.totalDeleted = addDeletedCounts(this.totalDeleted, input.deletedCounts);
    this.lastDeletedCounts = { ...input.deletedCounts };
    this.lastCleanupLagSeconds = input.cleanupLagSeconds;
    this.lastRanAt = input.ranAt.toISOString();
    recordDomainMetricSafely(this.domainMetrics, (metrics) => {
      const deletedCountEntries = Object.entries(input.deletedCounts) as Array<
        [keyof AuthCleanupDeletedCounts, number]
      >;
      for (const [target, value] of deletedCountEntries) {
        metrics.incrementCounter({
          name: 'api_auth_cleanup_deleted_total',
          labels: { target },
          value,
        });
      }
      metrics.setGauge({
        name: 'api_auth_cleanup_lag_seconds',
        value: input.cleanupLagSeconds,
      });
    });
  }

  recordCleanupFailure(input: { now: Date }) {
    this.totalFailures += 1;
    this.lastFailureAt = input.now.toISOString();
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({ name: 'api_auth_cleanup_failures_total' }),
    );
  }

  recordRedisGate(evaluation: AuthRedisGateEvaluation) {
    this.redisGate = evaluation;
    recordDomainMetricSafely(this.domainMetrics, (metrics) => {
      for (const state of ['postgres_authoritative', 'redis_candidate'] as const) {
        metrics.setGauge({
          name: 'api_auth_redis_gate_state',
          labels: { state },
          value: state === evaluation.decision ? 1 : 0,
        });
      }
    });
  }

  recordSecurityAlerts(alerts: readonly AuthSecurityAlert[], mailOutboxLagSeconds: number) {
    this.securityAlerts = alerts.map((alert) => ({ ...alert }));
    recordDomainMetricSafely(this.domainMetrics, (metrics) => {
      const activeKinds = new Set(alerts.map((alert) => alert.kind));
      for (const kind of Object.values(AUTH_SECURITY_ALERT_KINDS)) {
        metrics.setGauge({
          name: 'api_auth_security_alert_active',
          labels: { reason: kind },
          value: activeKinds.has(kind) ? 1 : 0,
        });
      }
      metrics.setGauge({
        name: 'api_auth_mail_outbox_lag_seconds',
        value: Math.max(0, mailOutboxLagSeconds),
      });
    });
  }

  snapshot(): AuthOperationsMetricsSnapshot {
    return {
      cleanup: {
        totalDeleted: { ...this.totalDeleted },
        lastDeletedCounts: { ...this.lastDeletedCounts },
        lastCleanupLagSeconds: this.lastCleanupLagSeconds,
        lastRanAt: this.lastRanAt,
        lastFailureAt: this.lastFailureAt,
        totalFailures: this.totalFailures,
      },
      redisGate: this.redisGate ? { ...this.redisGate } : null,
      securityAlerts: this.securityAlerts.map((alert) => ({ ...alert })),
    };
  }
}
