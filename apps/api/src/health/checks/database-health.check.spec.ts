import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { DatabaseHealthCheck } from './database-health.check.js';

const databaseNow = new Date('2026-06-02T03:00:00.000Z');

describe('DatabaseHealthCheck', () => {
  let dateNowSpy: MockInstance<() => number>;

  beforeEach(() => {
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(databaseNow.getTime());
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  it('database now probe 성공을 up으로 반환한다', async () => {
    const prisma = { getDatabaseNow: vi.fn().mockResolvedValue(databaseNow) };
    const check = new DatabaseHealthCheck(prisma as never);

    await expect(check.check()).resolves.toEqual({
      name: 'database',
      status: 'up',
      code: 'DATABASE_UP',
      checkedAt: '2026-06-02T03:00:00.000Z',
      elapsedMs: 0,
    });
  });

  it('database probe 실패는 raw error 없이 down code로 축약한다', async () => {
    const prisma = { getDatabaseNow: vi.fn().mockRejectedValue(new Error('postgres://secret')) };
    const check = new DatabaseHealthCheck(prisma as never);

    await expect(check.check()).resolves.toEqual({
      name: 'database',
      status: 'down',
      code: 'DATABASE_UNAVAILABLE',
      checkedAt: '2026-06-02T03:00:00.000Z',
      elapsedMs: 0,
    });
  });
});
