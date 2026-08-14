import { Injectable } from '@nestjs/common';
import { getDatabaseReadiness } from '../../generated/prisma/sql.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  DEFAULT_HEALTH_READINESS_TIMEOUT_MS,
  type HealthReadinessCheck,
  type HealthReadinessCheckResult,
} from './health-check.types.js';
import { createHealthCheckResult } from './health-check-result.js';
import { HealthReadinessTimeoutError, withReadinessTimeout } from './readiness-timeout.js';

@Injectable()
export class DatabaseHealthCheck implements HealthReadinessCheck {
  readonly name = 'database' as const;

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthReadinessCheckResult> {
    const startedAtMs = Date.now();

    try {
      const [row] = await withReadinessTimeout(
        this.name,
        this.prisma.$queryRawTyped(getDatabaseReadiness()),
        DEFAULT_HEALTH_READINESS_TIMEOUT_MS,
      );

      if (
        !row ||
        typeof row.epochSeconds !== 'number' ||
        !Number.isFinite(row.epochSeconds) ||
        row.failedCount === null ||
        row.incompleteCount === null
      ) {
        return this.down('MIGRATION_BASELINE_UNAVAILABLE', startedAtMs);
      }

      if (toNumber(row.failedCount) > 0) {
        return this.down('MIGRATION_BASELINE_FAILED', startedAtMs);
      }

      if (toNumber(row.incompleteCount) > 0) {
        return this.down('MIGRATION_BASELINE_INCOMPLETE', startedAtMs);
      }

      return createHealthCheckResult({
        name: this.name,
        status: 'up',
        code: 'DATABASE_UP',
        startedAtMs,
        checkedAt: new Date(row.epochSeconds * 1_000),
      });
    } catch (error) {
      return createHealthCheckResult({
        name: this.name,
        status: 'down',
        code:
          error instanceof HealthReadinessTimeoutError
            ? 'DATABASE_TIMEOUT'
            : 'DATABASE_UNAVAILABLE',
        startedAtMs,
      });
    }
  }

  private down(
    code:
      | 'DATABASE_UNAVAILABLE'
      | 'DATABASE_TIMEOUT'
      | 'MIGRATION_BASELINE_UNAVAILABLE'
      | 'MIGRATION_BASELINE_FAILED'
      | 'MIGRATION_BASELINE_INCOMPLETE',
    startedAtMs: number,
  ): HealthReadinessCheckResult {
    return createHealthCheckResult({
      name: this.name,
      status: 'down',
      code,
      startedAtMs,
    });
  }
}

function toNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}
