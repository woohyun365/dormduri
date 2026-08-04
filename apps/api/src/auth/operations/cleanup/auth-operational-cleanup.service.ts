import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import authOperationsConfig from '../../../config/auth-operations.config.js';
import { RetentionWorkerPrismaService } from '../../../platform/database/prisma.service.js';
import {
  AuthOperationalCleanupRepository,
  type AuthCleanupBatchResult,
} from './auth-operational-cleanup.repository.js';
import {
  AUTH_CLEANUP_TARGETS,
  AuthCleanupMetricsService,
  type AuthCleanupTarget,
} from './auth-cleanup-metrics.service.js';

const MS_PER_DAY = 24 * 60 * 60 * 1_000;

export interface AuthOperationalCleanupResult extends AuthCleanupBatchResult {
  batchSaturatedTargets: AuthCleanupTarget[];
  ranAt: string;
}

/**
 * Auth cleanup intentionally reuses the retention worker Prisma boundary.
 * A separate credential/client would add another connection pool without
 * changing the current cleanup authority or product behavior.
 */
@Injectable()
export class AuthOperationalCleanupService {
  constructor(
    private readonly prisma: RetentionWorkerPrismaService,
    private readonly repository: AuthOperationalCleanupRepository,
    private readonly metrics: AuthCleanupMetricsService,
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
      const batchSaturatedTargets = this.resolveBatchSaturatedTargets(result);
      this.metrics.recordCleanup({
        deletedCounts: result,
        batchSaturatedTargets,
        ranAt: referenceNow,
      });
      return {
        ...result,
        batchSaturatedTargets,
        ranAt: referenceNow.toISOString(),
      };
    } catch (error) {
      this.metrics.recordCleanupFailure({ now: referenceNow });
      throw error;
    }
  }

  private resolveBatchSaturatedTargets(result: AuthCleanupBatchResult): AuthCleanupTarget[] {
    return AUTH_CLEANUP_TARGETS.filter(
      (target) => result[target] >= this.settings.cleanupBatchSize,
    );
  }
}

function subtractDays(date: Date, days: number) {
  return new Date(date.getTime() - days * MS_PER_DAY);
}
