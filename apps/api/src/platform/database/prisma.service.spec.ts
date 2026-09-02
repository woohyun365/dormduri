import { describe, expect, it, vi, type Mock } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { Prisma } from '../../generated/prisma/client.js';
import {
  buildPrismaSessionOptions,
  PRISMA_SESSION_TIME_ZONE,
  PrismaService,
  recordPrismaConnectionAdapterError,
  stripPrismaConnectionOptions,
} from './prisma.service.js';
import type { AppLoggerService } from '../observability/logging/app-logger.service.js';
import { PrismaPoolMetricsService } from '../observability/metrics/prisma-pool-metrics.service.js';
import type { DomainMetricsPort } from '../observability/metrics/domain-metrics.port.js';

type TransactionCallback = (tx: unknown) => Promise<unknown>;
type TransactionOptions = { isolationLevel?: unknown };

type PrismaServiceHarness = Omit<PrismaService, '$transaction' | '$queryRawTyped'> & {
  $transaction: Mock<(arg0: TransactionCallback, arg1?: TransactionOptions) => Promise<unknown>>;
  $queryRawTyped: Mock<(...args: unknown[]) => Promise<unknown[]>>;
};

function makeHarness(
  input: {
    poolMetrics?: Pick<PrismaPoolMetricsService, 'recordSerializableTransactionRetry'>;
  } = {},
): PrismaServiceHarness {
  const harness = Object.create(PrismaService.prototype) as PrismaServiceHarness;
  harness.$transaction =
    vi.fn<(arg0: TransactionCallback, arg1?: TransactionOptions) => Promise<unknown>>();
  harness.$queryRawTyped = vi.fn<(...args: unknown[]) => Promise<unknown[]>>();
  Object.defineProperty(harness, 'poolMetrics', {
    configurable: true,
    value: input.poolMetrics,
  });
  return harness;
}

function makeSerializationConflict() {
  return new Error('serialization failure', {
    cause: { originalCode: '40001', kind: 'TransactionWriteConflict' },
  });
}

describe('PrismaService serializable transaction retry', () => {
  it('serialization conflict는 Serializable isolation으로 재시도하고 성공 값을 반환한다', async () => {
    const poolMetrics = { recordSerializableTransactionRetry: vi.fn() };
    const harness = makeHarness({ poolMetrics });
    const tx = { tx: true };
    const operation = vi.fn().mockResolvedValue('committed');
    let attempt = 0;

    harness.$transaction.mockImplementation(async (callback) => {
      attempt += 1;
      if (attempt === 1) {
        throw makeSerializationConflict();
      }
      return callback(tx);
    });

    await expect(harness.runSerializableTransaction(operation, 2)).resolves.toBe('committed');

    expect(harness.$transaction).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledWith(tx);
    for (const [, options] of harness.$transaction.mock.calls) {
      expect(options).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
    expect(poolMetrics.recordSerializableTransactionRetry).toHaveBeenCalledWith('retry');
    expect(poolMetrics.recordSerializableTransactionRetry).not.toHaveBeenCalledWith('exhausted');
  });

  it('retry 횟수를 소진하면 마지막 serialization conflict를 그대로 노출한다', async () => {
    const poolMetrics = { recordSerializableTransactionRetry: vi.fn() };
    const harness = makeHarness({ poolMetrics });
    const conflict = makeSerializationConflict();
    const operation = vi.fn().mockResolvedValue('unreachable');

    harness.$transaction.mockRejectedValue(conflict);

    await expect(harness.runSerializableTransaction(operation, 2)).rejects.toBe(conflict);
    expect(harness.$transaction).toHaveBeenCalledTimes(2);
    expect(operation).not.toHaveBeenCalled();
    expect(poolMetrics.recordSerializableTransactionRetry).toHaveBeenCalledWith('retry');
    expect(poolMetrics.recordSerializableTransactionRetry).toHaveBeenCalledWith('exhausted');
  });
});

describe('PrismaService database clock', () => {
  it('Prisma pg session timezone은 timestamptz adapter 경계를 위해 UTC로 고정한다', () => {
    expect(PRISMA_SESSION_TIME_ZONE).toBe('UTC');
    expect(buildPrismaSessionOptions('public')).toBe('-c timezone=UTC -c search_path=public');
    expect(buildPrismaSessionOptions(null)).toBe('-c timezone=UTC');
    expect(() => buildPrismaSessionOptions('public -c role=admin')).toThrow(
      '[PrismaService] invalid database schema identifier',
    );
    expect(
      stripPrismaConnectionOptions(
        'postgresql://user:secret@localhost:5432/app?schema=test&options=-c+search_path%3Dtest',
      ),
    ).toBe('postgresql://user:secret@localhost:5432/app?schema=test');
  });

  it('timezone 해석에 의존하지 않는 epoch seconds를 UTC Date로 변환한다', async () => {
    const harness = makeHarness();
    const expected = new Date('2026-07-30T04:31:36.742Z');
    harness.$queryRawTyped.mockResolvedValue([{ epochSeconds: expected.getTime() / 1_000 }]);

    await expect(harness.getDatabaseNow()).resolves.toEqual(expected);
  });

  it.each([
    { rows: [] },
    { rows: [{ epochSeconds: Number.NaN }] },
    { rows: [{ epochSeconds: '1787569896' }] },
  ])('유효한 epoch seconds가 없으면 fail-closed 처리한다', async ({ rows }) => {
    const harness = makeHarness();
    harness.$queryRawTyped.mockResolvedValue(rows);

    await expect(harness.getDatabaseNow()).rejects.toThrow(
      '[PrismaService] failed to resolve database current timestamp',
    );
  });
});

describe('PrismaService pg adapter compatibility', () => {
  it('Prisma adapter와 runtime은 동일한 pg Pool constructor를 사용한다', async () => {
    const pool = new Pool();
    const adapter = await new PrismaPg(pool, { disposeExternalPool: false }).connect();

    try {
      expect(adapter.underlyingDriver()).toBe(pool);
    } finally {
      await adapter.dispose();
      await pool.end();
    }
  });
});

describe('PrismaPoolMetricsService', () => {
  it('pool snapshot과 transaction retry를 bounded labels로 기록한다', () => {
    const domainMetrics = makeDomainMetrics();
    const service = new PrismaPoolMetricsService(domainMetrics, {
      metricsEnabled: true,
    } as never);

    const unregister = service.registerPool({
      snapshotPoolMetrics: () => ({ total: 5, idle: 2, waiting: 1 }),
    });
    service.recordSerializableTransactionRetry('retry');
    unregister();

    expect(domainMetrics.setGauge).toHaveBeenCalledWith({
      name: 'api_prisma_pool_connections',
      labels: { state: 'total' },
      value: 5,
    });
    expect(domainMetrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_prisma_transaction_retries_total',
      labels: { outcome: 'retry' },
    });
    expect(JSON.stringify(domainMetrics.setGauge.mock.calls)).not.toContain('DATABASE_URL');
    expect(JSON.stringify(domainMetrics.setGauge.mock.calls)).not.toContain('postgresql://');
  });
});

describe('recordPrismaConnectionAdapterError', () => {
  it('records pg adapter errors without dumping raw error details', () => {
    const write = vi.fn();
    const logger = {
      write,
    } as unknown as AppLoggerService;
    const error = new Error('connection string postgresql://user:password@db leaked');

    recordPrismaConnectionAdapterError(logger, {
      error,
      label: 'PrismaService',
      operation: 'pg_pool_error',
    });

    expect(write).toHaveBeenCalledWith(
      'error',
      {
        context: 'PrismaService',
        domain: 'system',
        errorName: 'Error',
        operation: 'pg_pool_error',
        outcome: 'failure',
      },
      'database connection adapter error',
    );
    expect(JSON.stringify(write.mock.calls)).not.toContain('postgresql://');
    expect(JSON.stringify(write.mock.calls)).not.toContain('password');
  });
});

function makeDomainMetrics() {
  return {
    incrementCounter: vi.fn(),
    setGauge: vi.fn(),
    observeHistogram: vi.fn(),
  } satisfies DomainMetricsPort;
}
