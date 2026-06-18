import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { MigrationBaselineHealthCheck } from './migration-baseline-health.check.js';

describe('MigrationBaselineHealthCheck', () => {
  let dateNowSpy: MockInstance<() => number>;

  beforeEach(() => {
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-02T03:00:00.000Z'));
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  it('failed/incomplete migration이 없으면 up이다', async () => {
    const prisma = {
      $queryRawTyped: vi.fn().mockResolvedValue([{ failed_count: 0, incomplete_count: 0 }]),
    };
    const check = new MigrationBaselineHealthCheck(prisma as never);

    await expect(check.check()).resolves.toMatchObject({
      name: 'migration',
      status: 'up',
      code: 'MIGRATION_BASELINE_UP',
    });
  });

  it('rolled back migration이 있으면 failed code를 반환한다', async () => {
    const prisma = {
      $queryRawTyped: vi.fn().mockResolvedValue([{ failed_count: 1, incomplete_count: 0 }]),
    };
    const check = new MigrationBaselineHealthCheck(prisma as never);

    await expect(check.check()).resolves.toMatchObject({
      name: 'migration',
      status: 'down',
      code: 'MIGRATION_BASELINE_FAILED',
    });
  });

  it('finished 되지 않은 migration이 있으면 incomplete code를 반환한다', async () => {
    const prisma = {
      $queryRawTyped: vi.fn().mockResolvedValue([{ failed_count: 0, incomplete_count: 1 }]),
    };
    const check = new MigrationBaselineHealthCheck(prisma as never);

    await expect(check.check()).resolves.toMatchObject({
      name: 'migration',
      status: 'down',
      code: 'MIGRATION_BASELINE_INCOMPLETE',
    });
  });

  it('migration table probe 실패는 raw error 없이 unavailable code로 축약한다', async () => {
    const prisma = {
      $queryRawTyped: vi
        .fn()
        .mockRejectedValue(new Error('permission denied for _prisma_migrations')),
    };
    const check = new MigrationBaselineHealthCheck(prisma as never);

    await expect(check.check()).resolves.toMatchObject({
      name: 'migration',
      status: 'down',
      code: 'MIGRATION_BASELINE_UNAVAILABLE',
    });
  });
});
