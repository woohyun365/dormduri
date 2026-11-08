import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { getDatabaseTableMaintenanceStats } from '@repo/database/sql';
import {
  BackgroundJobMetricsService,
  runBackgroundJobTick,
} from '../../background-jobs/background-job-metrics.service.js';
import {
  DOMAIN_METRICS_PORT,
  recordDomainMetricSafely,
  type DomainMetricsPort,
} from '../observability/metrics/domain-metrics.port.js';
import observabilityConfig from '../observability/observability.config.js';
import { PrismaService } from './prisma.service.js';

export const DATABASE_TABLE_STATS_INTERVAL_MS = 15 * 60 * 1_000;

/** Delete-heavy tables from the maintenance baseline in `infra/db/README.md`. */
export const DATABASE_MAINTENANCE_TABLES = [
  'AuthMailOutboxEvent',
  'ChatRealtimeOutboxEvent',
  'NotificationOutboxEvent',
  'AuthSecurityEvent',
  'AuthSession',
  'LoginAttempt',
  'VerificationCode',
  'VerificationCodeRequestLog',
  'ArchiveJob',
  'RetentionAccessLog',
  'RetentionReviewJob',
] as const;

@Injectable()
export class DatabaseTableStatsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseTableStatsService.name);
  private interval: ReturnType<typeof setInterval> | null = null;
  private activeRead: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(observabilityConfig.KEY)
    private readonly settings: ConfigType<typeof observabilityConfig>,
    @Inject(DOMAIN_METRICS_PORT)
    private readonly domainMetrics: DomainMetricsPort,
    private readonly backgroundJobMetrics: BackgroundJobMetricsService,
  ) {}

  onApplicationBootstrap() {
    if (!this.settings.metricsEnabled) {
      return;
    }

    this.interval = setInterval(() => {
      this.startScheduledRead();
    }, DATABASE_TABLE_STATS_INTERVAL_MS);
    this.interval.unref?.();
  }

  async onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    // The read is bounded by the pool's connection and statement timeouts.
    await this.activeRead;
  }

  async collectOnce(): Promise<void> {
    const rows = await this.prisma.$queryRawTyped(
      getDatabaseTableMaintenanceStats([...DATABASE_MAINTENANCE_TABLES]),
    );

    for (const row of rows) {
      if (row.tableName === null) {
        continue;
      }

      const labels = { table: row.tableName };
      const deadTuples = row.deadTuples ?? 0;
      recordDomainMetricSafely(this.domainMetrics, (metrics) => {
        metrics.setGauge({
          name: 'api_db_table_dead_tuple_ratio',
          labels,
          value: deadTuples / Math.max(row.liveTuples ?? 0, 1),
        });
        metrics.setGauge({ name: 'api_db_table_dead_tuples', labels, value: deadTuples });
        if (row.lastAutovacuumEpochSeconds !== null) {
          metrics.setGauge({
            name: 'api_db_table_last_autovacuum_timestamp_seconds',
            labels,
            value: row.lastAutovacuumEpochSeconds,
          });
        }
      });
    }
  }

  private startScheduledRead() {
    if (this.activeRead) {
      return;
    }

    this.activeRead = runBackgroundJobTick(
      this.backgroundJobMetrics,
      'database_table_stats',
      async () => {
        await this.collectOnce();
        return 'succeeded';
      },
    )
      .catch((error: unknown) => {
        // The driver message can carry connection details, so only the error type is logged.
        this.logger.error(
          `Database table stats read failed (${error instanceof Error ? error.name : 'UnknownError'}).`,
        );
      })
      .finally(() => {
        this.activeRead = null;
      });
  }
}
