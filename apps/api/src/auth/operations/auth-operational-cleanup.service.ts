import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import authOperationsConfig from '../../config/auth-operations.config.js';
import { RetentionWorkerPrismaService } from '../../platform/database/prisma.service.js';
import {
  AuthOperationalCleanupRepository,
  type AuthCleanupBatchResult,
} from './auth-operational-cleanup.repository.js';
import { AuthOperationalMetricsService } from './auth-operational-metrics.service.js';
import { AuthSecurityAlertRepository } from './auth-security-alert.repository.js';
import {
  AUTH_SECURITY_ALERT_WINDOW_MS,
  evaluateAuthSecurityEventAlerts,
} from '../security-events/security-alert.policy.js';

const MS_PER_DAY = 24 * 60 * 60 * 1_000;

export interface AuthOperationalCleanupResult extends AuthCleanupBatchResult {
  cleanupLagSeconds: number;
  ranAt: string;
}

/**
 * Auth cleanup intentionally runs through the existing retention worker Prisma
 * boundary. The `auth_cleanup_worker` DB role grant artifact is a
 * future infra split candidate; creating a separate Prisma client/pool now would
 * increase RDS connection budget before production metrics justify it.
 */
@Injectable()
export class AuthOperationalCleanupService {
  constructor(
    private readonly prisma: RetentionWorkerPrismaService,
    private readonly repository: AuthOperationalCleanupRepository,
    private readonly metrics: AuthOperationalMetricsService,
    private readonly securityAlertRepository: AuthSecurityAlertRepository,
    @Inject(authOperationsConfig.KEY)
    private readonly settings: ConfigType<typeof authOperationsConfig>,
  ) {}

  async runCleanupBatch(now?: Date): Promise<AuthOperationalCleanupResult> {
    const referenceNow = now ?? (await this.prisma.getDatabaseNow());

    try {
      const result = await this.repository.pruneBatch(this.prisma, {
        expiredSessionCutoff: subtractDays(referenceNow, this.settings.expiredSessionRetentionDays),
        verificationCodeCutoff: subtractDays(
          referenceNow,
          this.settings.verificationCodeRetentionDays,
        ),
        verificationRequestLogCutoff: subtractDays(
          referenceNow,
          this.settings.verificationRequestLogRetentionDays,
        ),
        loginAttemptCutoff: subtractDays(referenceNow, this.settings.loginAttemptRetentionDays),
        securityEventCutoff: subtractDays(referenceNow, this.settings.securityEventRetentionDays),
        batchSize: this.settings.cleanupBatchSize,
      });
      const cleanupLagSeconds = this.resolveCleanupLagSeconds(result);
      const alertSignals = await this.securityAlertRepository.readSignals(this.prisma, {
        since: new Date(referenceNow.getTime() - AUTH_SECURITY_ALERT_WINDOW_MS),
        now: referenceNow,
      });
      const securityAlerts = evaluateAuthSecurityEventAlerts(alertSignals.events, referenceNow, {
        mailOutboxLagSeconds: alertSignals.mailOutboxLagSeconds,
        mailOutboxLagAlertSeconds: this.settings.mailOutboxLagAlertSeconds,
      });

      this.metrics.recordCleanup({
        deletedCounts: result,
        cleanupLagSeconds,
        ranAt: referenceNow,
      });
      this.metrics.recordSecurityAlerts(securityAlerts, alertSignals.mailOutboxLagSeconds);

      return {
        ...result,
        cleanupLagSeconds,
        ranAt: referenceNow.toISOString(),
      };
    } catch (error) {
      this.metrics.recordCleanupFailure({ now: referenceNow });
      throw error;
    }
  }

  private resolveCleanupLagSeconds(result: AuthCleanupBatchResult) {
    const deletedCount =
      result.expiredSessions +
      result.verificationCodes +
      result.verificationRequestLogs +
      result.loginAttempts +
      result.securityEvents;

    return deletedCount >= this.settings.cleanupBatchSize
      ? this.settings.cleanupLagAlertSeconds
      : 0;
  }
}

function subtractDays(date: Date, days: number) {
  return new Date(date.getTime() - days * MS_PER_DAY);
}
