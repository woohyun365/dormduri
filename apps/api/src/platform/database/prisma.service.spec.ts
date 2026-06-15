import { describe, expect, it, vi, type Mock } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import {
  calculatePrismaConnectionPoolBudget,
  PrismaService,
  recordPrismaConnectionAdapterError,
} from './prisma.service.js';
import type { AppLoggerService } from '../observability/logging/app-logger.service.js';

type TransactionCallback = (tx: unknown) => Promise<unknown>;
type TransactionOptions = { isolationLevel?: unknown };

type PrismaServiceHarness = Omit<PrismaService, '$transaction'> & {
  $transaction: Mock<(arg0: TransactionCallback, arg1?: TransactionOptions) => Promise<unknown>>;
};

function makeHarness(): PrismaServiceHarness {
  const harness = Object.create(PrismaService.prototype) as PrismaServiceHarness;
  harness.$transaction =
    vi.fn<(arg0: TransactionCallback, arg1?: TransactionOptions) => Promise<unknown>>();
  return harness;
}

function makeSerializationConflict() {
  return new Error('serialization failure', {
    cause: { originalCode: '40001', kind: 'TransactionWriteConflict' },
  });
}

describe('PrismaService serializable transaction retry', () => {
  it('serialization conflict는 Serializable isolation으로 재시도하고 성공 값을 반환한다', async () => {
    const harness = makeHarness();
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
  });

  it('retry 횟수를 소진하면 마지막 serialization conflict를 그대로 노출한다', async () => {
    const harness = makeHarness();
    const conflict = makeSerializationConflict();
    const operation = vi.fn().mockResolvedValue('unreachable');

    harness.$transaction.mockRejectedValue(conflict);

    await expect(harness.runSerializableTransaction(operation, 2)).rejects.toBe(conflict);
    expect(harness.$transaction).toHaveBeenCalledTimes(2);
    expect(operation).not.toHaveBeenCalled();
  });
});

describe('calculatePrismaConnectionPoolBudget', () => {
  it('runtime/worker/read-only disclosure pool 비용과 future role 증가 비용을 명시한다', () => {
    expect(calculatePrismaConnectionPoolBudget({ poolMax: 10 }, { alertRatio: 0.8 })).toEqual({
      activeRoles: ['runtime', 'retention_worker', 'retention_disclosure'],
      poolMaxPerRole: 10,
      activePoolMaxConnections: 30,
      migrationConnectionIncludedInAppPool: false,
      futureRolePoolCost: [
        {
          role: 'auth_cleanup_worker',
          additionalMaxConnections: 10,
        },
        {
          role: 'read_only_operations',
          additionalMaxConnections: 10,
        },
      ],
      alertAtEstimatedConnections: 24,
    });
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
