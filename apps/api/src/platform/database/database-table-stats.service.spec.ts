import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DomainMetricsPort } from '../observability/metrics/domain-metrics.port.js';
import { assertDomainMetricLabelNames } from '../observability/metrics/metric-label.policy.js';
import {
  DATABASE_MAINTENANCE_TABLES,
  DATABASE_TABLE_STATS_INTERVAL_MS,
  DatabaseTableStatsService,
} from './database-table-stats.service.js';
import { PRISMA_METRIC_DEFINITIONS } from './prisma-metric.definitions.js';

const row = (input: {
  tableName: string;
  liveTuples: number;
  deadTuples: number;
  lastAutovacuumEpochSeconds: number | null;
}) => input;

function createFixture(metricsEnabled = true) {
  const prisma = { $queryRawTyped: vi.fn().mockResolvedValue([]) };
  const domainMetrics = {
    incrementCounter: vi.fn<DomainMetricsPort['incrementCounter']>(),
    setGauge: vi.fn<DomainMetricsPort['setGauge']>(),
    observeHistogram: vi.fn<DomainMetricsPort['observeHistogram']>(),
  };
  const backgroundJobMetrics = { recordSucceeded: vi.fn(), recordFailed: vi.fn() };
  const service = new DatabaseTableStatsService(
    prisma as never,
    { metricsEnabled } as never,
    domainMetrics,
    backgroundJobMetrics as never,
  );
  return { service, prisma, domainMetrics, backgroundJobMetrics };
}

function gaugeLabels(fixture: ReturnType<typeof createFixture>, name: string) {
  return fixture.domainMetrics.setGauge.mock.calls
    .map(([input]) => input)
    .filter((input) => input.name === name);
}

describe('DatabaseTableStatsService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // database-table-stats.integration.spec.ts checks that every listed table exists after migration.
  it('watches the delete-heavy tables of the maintenance baseline', () => {
    expect([...DATABASE_MAINTENANCE_TABLES].sort()).toEqual([
      'ArchiveJob',
      'AuthMailOutboxEvent',
      'AuthSecurityEvent',
      'AuthSession',
      'ChatRealtimeOutboxEvent',
      'LoginAttempt',
      'NotificationOutboxEvent',
      'RetentionAccessLog',
      'RetentionReviewJob',
      'VerificationCode',
      'VerificationCodeRequestLog',
    ]);
  });

  it('defines the table gauges with the table name as their only label', () => {
    const definitions = PRISMA_METRIC_DEFINITIONS.filter(({ name }) =>
      name.startsWith('api_db_table_'),
    );

    expect(definitions.map(({ name }) => name).sort()).toEqual([
      'api_db_table_dead_tuple_ratio',
      'api_db_table_dead_tuples',
      'api_db_table_last_autovacuum_timestamp_seconds',
    ]);
    for (const definition of definitions) {
      expect(definition.kind).toBe('gauge');
      expect(definition.labelNames).toEqual(['table']);
      expect(() => assertDomainMetricLabelNames(definition.labelNames)).not.toThrow();
    }
  });

  it('reads the listed tables every 15 minutes and sets gauges labelled only by table', async () => {
    const f = createFixture();
    f.prisma.$queryRawTyped.mockResolvedValue([
      row({
        tableName: 'ArchiveJob',
        liveTuples: 200,
        deadTuples: 50,
        lastAutovacuumEpochSeconds: 1_790_000_000,
      }),
    ]);

    f.service.onApplicationBootstrap();
    expect(f.prisma.$queryRawTyped).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(DATABASE_TABLE_STATS_INTERVAL_MS);

    expect(DATABASE_TABLE_STATS_INTERVAL_MS).toBe(900_000);
    expect(f.prisma.$queryRawTyped).toHaveBeenCalledTimes(1);
    const typedSql = f.prisma.$queryRawTyped.mock.calls[0]?.[0] as { values: unknown[] };
    expect(typedSql.values).toEqual([[...DATABASE_MAINTENANCE_TABLES]]);
    expect(f.domainMetrics.setGauge.mock.calls.map(([input]) => input)).toEqual([
      {
        name: 'api_db_table_dead_tuple_ratio',
        labels: { table: 'ArchiveJob' },
        value: 0.25,
      },
      { name: 'api_db_table_dead_tuples', labels: { table: 'ArchiveJob' }, value: 50 },
      {
        name: 'api_db_table_last_autovacuum_timestamp_seconds',
        labels: { table: 'ArchiveJob' },
        value: 1_790_000_000,
      },
    ]);
    expect(f.backgroundJobMetrics.recordSucceeded).toHaveBeenCalledExactlyOnceWith(
      'database_table_stats',
    );

    await vi.advanceTimersByTimeAsync(DATABASE_TABLE_STATS_INTERVAL_MS);
    expect(f.prisma.$queryRawTyped).toHaveBeenCalledTimes(2);
  });

  it('divides by one when the table has no live rows', async () => {
    const f = createFixture();
    f.prisma.$queryRawTyped.mockResolvedValue([
      row({
        tableName: 'AuthSession',
        liveTuples: 0,
        deadTuples: 4,
        lastAutovacuumEpochSeconds: null,
      }),
    ]);

    await f.service.collectOnce();

    expect(gaugeLabels(f, 'api_db_table_dead_tuple_ratio')[0]?.value).toBe(4);
  });

  it('sets no autovacuum timestamp for a table that was never autovacuumed', async () => {
    const f = createFixture();
    f.prisma.$queryRawTyped.mockResolvedValue([
      row({
        tableName: 'AuthSession',
        liveTuples: 2,
        deadTuples: 0,
        lastAutovacuumEpochSeconds: null,
      }),
    ]);

    await f.service.collectOnce();

    expect(gaugeLabels(f, 'api_db_table_dead_tuples')).toHaveLength(1);
    expect(gaugeLabels(f, 'api_db_table_last_autovacuum_timestamp_seconds')).toEqual([]);
  });

  it('counts a failed read, sets no gauge and logs without the driver message', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const f = createFixture();
    f.prisma.$queryRawTyped.mockRejectedValue(new Error('connection to secret-host failed'));

    f.service.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(DATABASE_TABLE_STATS_INTERVAL_MS);

    expect(f.domainMetrics.setGauge).not.toHaveBeenCalled();
    expect(f.backgroundJobMetrics.recordFailed).toHaveBeenCalledExactlyOnceWith(
      'database_table_stats',
    );
    expect(f.backgroundJobMetrics.recordSucceeded).not.toHaveBeenCalled();
    expect(JSON.stringify(error.mock.calls)).not.toContain('secret-host');
  });

  it('does not schedule a read when metrics are disabled', async () => {
    const f = createFixture(false);

    f.service.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(DATABASE_TABLE_STATS_INTERVAL_MS);

    expect(vi.getTimerCount()).toBe(0);
    expect(f.prisma.$queryRawTyped).not.toHaveBeenCalled();
  });

  it('waits for an in-flight read on destroy and schedules no further read', async () => {
    const f = createFixture();
    let finishRead!: (rows: unknown[]) => void;
    f.prisma.$queryRawTyped.mockReturnValue(
      new Promise((resolvePromise) => {
        finishRead = resolvePromise;
      }),
    );
    f.service.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(DATABASE_TABLE_STATS_INTERVAL_MS);
    const settled = vi.fn();

    const destroyed = f.service.onModuleDestroy().then(settled);
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).not.toHaveBeenCalled();

    finishRead([]);
    await destroyed;

    expect(settled).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(DATABASE_TABLE_STATS_INTERVAL_MS);
    expect(f.prisma.$queryRawTyped).toHaveBeenCalledTimes(1);
  });
});
