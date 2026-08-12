import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  DOMAIN_METRICS_PORT,
  recordDomainMetricSafely,
  type DomainMetricsPort,
} from '../../../platform/observability/metrics/domain-metrics.port.js';
export interface AuthCleanupMetricsInput {
  deletedCounts: AuthCleanupDeletedCounts;
  batchSaturatedTargets: AuthCleanupTarget[];
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

@Injectable()
export class AuthCleanupMetricsService {
  constructor(
    @Optional()
    @Inject(DOMAIN_METRICS_PORT)
    private readonly domainMetrics?: DomainMetricsPort,
  ) {}

  recordCleanup(input: AuthCleanupMetricsInput) {
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

  recordCleanupFailure() {
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({ name: 'api_auth_cleanup_failures_total' }),
    );
  }
}
