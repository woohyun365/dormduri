import { Injectable } from '@nestjs/common';
import { getMigrationBaselineHealth } from '../../generated/prisma/sql.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  DEFAULT_HEALTH_READINESS_TIMEOUT_MS,
  type HealthReadinessCheck,
  type HealthReadinessCheckResult,
} from './health-check.types.js';
import { createHealthCheckResult } from './health-check-result.js';
import { HealthReadinessTimeoutError, withReadinessTimeout } from './readiness-timeout.js';

@Injectable()
export class MigrationBaselineHealthCheck implements HealthReadinessCheck {
  readonly name = 'migration' as const;

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthReadinessCheckResult> {
    const startedAtMs = Date.now();

    try {
      const [row] = await withReadinessTimeout(
        this.name,
        this.prisma.$queryRawTyped(getMigrationBaselineHealth()),
        DEFAULT_HEALTH_READINESS_TIMEOUT_MS,
      );

      if (!row) {
        return this.down('MIGRATION_BASELINE_UNAVAILABLE', startedAtMs);
      }

      if (toNumber(row.failed_count) > 0) {
        return this.down('MIGRATION_BASELINE_FAILED', startedAtMs);
      }

      if (toNumber(row.incomplete_count) > 0) {
        return this.down('MIGRATION_BASELINE_INCOMPLETE', startedAtMs);
      }

      return createHealthCheckResult({
        name: this.name,
        status: 'up',
        code: 'MIGRATION_BASELINE_UP',
        startedAtMs,
      });
    } catch (error) {
      return this.down(
        error instanceof HealthReadinessTimeoutError
          ? 'MIGRATION_BASELINE_TIMEOUT'
          : 'MIGRATION_BASELINE_UNAVAILABLE',
        startedAtMs,
      );
    }
  }

  private down(
    code:
      | 'MIGRATION_BASELINE_UNAVAILABLE'
      | 'MIGRATION_BASELINE_FAILED'
      | 'MIGRATION_BASELINE_INCOMPLETE'
      | 'MIGRATION_BASELINE_TIMEOUT',
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

function toNumber(value: number | bigint | null): number {
  if (value === null) {
    throw new Error('Migration baseline count is null.');
  }

  return typeof value === 'bigint' ? Number(value) : value;
}
