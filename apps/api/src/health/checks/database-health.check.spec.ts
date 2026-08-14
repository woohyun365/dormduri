import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { DatabaseHealthCheck } from './database-health.check.js';

const databaseNow = new Date('2026-06-02T03:00:00.000Z');

describe('DatabaseHealthCheck', () => {
  let dateNowSpy: MockInstance<() => number>;

  beforeEach(() => {
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(databaseNow.getTime());
  });

  afterEach(() => dateNowSpy.mockRestore());

  it('단일 query로 DB clock과 migration baseline을 확인한다', async () => {
    const prisma = {
      $queryRawTyped: vi
        .fn()
        .mockResolvedValue([
          { epochSeconds: databaseNow.getTime() / 1_000, failedCount: 0, incompleteCount: 0 },
        ]),
    };
    const check = new DatabaseHealthCheck(prisma as never);

    await expect(check.check()).resolves.toEqual({
      name: 'database',
      status: 'up',
      code: 'DATABASE_UP',
      checkedAt: '2026-06-02T03:00:00.000Z',
      elapsedMs: 0,
    });
    expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      { epochSeconds: databaseNow.getTime() / 1_000, failedCount: 1, incompleteCount: 0 },
      'MIGRATION_BASELINE_FAILED',
    ],
    [
      { epochSeconds: databaseNow.getTime() / 1_000, failedCount: 0, incompleteCount: 1 },
      'MIGRATION_BASELINE_INCOMPLETE',
    ],
    [undefined, 'MIGRATION_BASELINE_UNAVAILABLE'],
  ] as const)('migration 이상 상태를 bounded code로 축약한다', async (row, code) => {
    const prisma = { $queryRawTyped: vi.fn().mockResolvedValue(row ? [row] : []) };
    const check = new DatabaseHealthCheck(prisma as never);

    await expect(check.check()).resolves.toMatchObject({
      name: 'database',
      status: 'down',
      code,
    });
  });

  it('database probe 실패는 raw error 없이 down code로 축약한다', async () => {
    const prisma = {
      $queryRawTyped: vi.fn().mockRejectedValue(new Error('postgres://secret')),
    };
    const check = new DatabaseHealthCheck(prisma as never);

    const result = await check.check();
    expect(result).toMatchObject({
      name: 'database',
      status: 'down',
      code: 'DATABASE_UNAVAILABLE',
    });
    expect(JSON.stringify(result)).not.toContain('postgres://secret');
  });

  it('database probe가 bounded timeout을 넘으면 timeout code로 축약한다', async () => {
    const prisma = {
      $queryRawTyped: vi.fn().mockReturnValue(new Promise(() => undefined)),
    };
    const check = new DatabaseHealthCheck(prisma as never);

    await expect(check.check()).resolves.toMatchObject({
      name: 'database',
      status: 'down',
      code: 'DATABASE_TIMEOUT',
    });
  });
});
