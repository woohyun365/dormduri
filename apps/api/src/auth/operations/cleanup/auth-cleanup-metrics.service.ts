import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  DOMAIN_METRICS_PORT,
  recordDomainMetricSafely,
  type DomainMetricsPort,
} from '../../../platform/observability/metrics/domain-metrics.port.js';
export interface AuthCleanupMetricsInput {
  deletedCounts: AuthCleanupDeletedCounts;
  batchSaturatedTargets: AuthCleanupTarget[];
  ranAt: Date;
}

export interface AuthCleanupDeletedCounts {
  expiredSessions: number;
  verificationCodes: number;
  verificationRequestLogs: number;
  loginAttempts: number;
  securityEvents: number;
}

export const AUTH_CLEANUP_TARGETS = [
  'expiredSessions',
  'verificationCodes',
  'verificationRequestLogs',
  'loginAttempts',
  'securityEvents',
] as const satisfies readonly (keyof AuthCleanupDeletedCounts)[];

export type AuthCleanupTarget = (typeof AUTH_CLEANUP_TARGETS)[number];

const AUTH_CLEANUP_TARGET_LABELS: Record<AuthCleanupTarget, string> = {
  expiredSessions: 'expired_sessions',
  verificationCodes: 'verification_codes',
  verificationRequestLogs: 'verification_request_logs',
  loginAttempts: 'login_attempts',
  securityEvents: 'security_events',
};

export interface AuthCleanupMetricsSnapshot {
  cleanup: {
    totalDeleted: AuthCleanupDeletedCounts;
    lastDeletedCounts: AuthCleanupDeletedCounts;
    lastBatchSaturatedTargets: AuthCleanupTarget[];
    lastRanAt: string | null;
    lastFailureAt: string | null;
    totalFailures: number;
  };
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
export class AuthCleanupMetricsService {
  constructor(
    @Optional()
    @Inject(DOMAIN_METRICS_PORT)
    private readonly domainMetrics?: DomainMetricsPort,
  ) {}

  private totalDeleted = emptyDeletedCounts();
  private lastDeletedCounts = emptyDeletedCounts();
  private lastBatchSaturatedTargets: AuthCleanupTarget[] = [];
  private lastRanAt: string | null = null;
  private lastFailureAt: string | null = null;
  private totalFailures = 0;
  recordCleanup(input: AuthCleanupMetricsInput) {
    this.totalDeleted = addDeletedCounts(this.totalDeleted, input.deletedCounts);
    this.lastDeletedCounts = { ...input.deletedCounts };
    this.lastBatchSaturatedTargets = [...input.batchSaturatedTargets];
    this.lastRanAt = input.ranAt.toISOString();
    recordDomainMetricSafely(this.domainMetrics, (metrics) => {
      const deletedCountEntries = Object.entries(input.deletedCounts) as Array<
        [keyof AuthCleanupDeletedCounts, number]
      >;
      for (const [target, value] of deletedCountEntries) {
        metrics.incrementCounter({
          name: 'api_auth_cleanup_deleted_total',
          labels: { target: AUTH_CLEANUP_TARGET_LABELS[target] },
          value,
        });
      }
      const saturatedTargets = new Set(input.batchSaturatedTargets);
      for (const target of AUTH_CLEANUP_TARGETS) {
        metrics.setGauge({
          name: 'api_auth_cleanup_batch_saturated',
          labels: { target: AUTH_CLEANUP_TARGET_LABELS[target] },
          value: saturatedTargets.has(target) ? 1 : 0,
        });
      }
    });
  }

  recordCleanupFailure(input: { now: Date }) {
    this.totalFailures += 1;
    this.lastFailureAt = input.now.toISOString();
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({ name: 'api_auth_cleanup_failures_total' }),
    );
  }

  snapshot(): AuthCleanupMetricsSnapshot {
    return {
      cleanup: {
        totalDeleted: { ...this.totalDeleted },
        lastDeletedCounts: { ...this.lastDeletedCounts },
        lastBatchSaturatedTargets: [...this.lastBatchSaturatedTargets],
        lastRanAt: this.lastRanAt,
        lastFailureAt: this.lastFailureAt,
        totalFailures: this.totalFailures,
      },
    };
  }
}
