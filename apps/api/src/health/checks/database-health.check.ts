import { Injectable } from '@nestjs/common';
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
      const databaseNow = await withReadinessTimeout(
        this.name,
        this.prisma.getDatabaseNow(),
        DEFAULT_HEALTH_READINESS_TIMEOUT_MS,
      );

      return createHealthCheckResult({
        name: this.name,
        status: 'up',
        code: 'DATABASE_UP',
        startedAtMs,
        checkedAt: databaseNow,
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
}
