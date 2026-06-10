import { disposeDueRetentionAccessLogs } from './retention-access-log-disposal.service.js';

describe('disposeDueRetentionAccessLogs', () => {
  it('TypedSQL bounded batch로 due access log metadata를 최소화하고 다음 dueAt을 반환한다', async () => {
    const now = new Date('2029-01-01T00:00:00.000Z');
    const nextDueAt = new Date('2029-02-01T00:00:00.000Z');
    const prisma = {
      $queryRawTyped: jest.fn().mockResolvedValue([{ id: 'log-1' }, { id: 'log-2' }]),
      retentionAccessLog: {
        findFirst: jest.fn().mockResolvedValue({ logRetentionHoldUntil: nextDueAt }),
      },
    };

    await expect(disposeDueRetentionAccessLogs(prisma as never, now)).resolves.toEqual({
      processedCount: 2,
      nextDueAt,
    });
    expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(1);
    expect(prisma.retentionAccessLog.findFirst).toHaveBeenCalledWith({
      where: {
        logRetentionDisposedAt: null,
        logRetentionHoldUntil: { not: null, gt: now },
      },
      select: { logRetentionHoldUntil: true },
      orderBy: { logRetentionHoldUntil: 'asc' },
    });
  });

  it('batch size를 안전 범위로 clamp한다', async () => {
    const now = new Date('2029-01-01T00:00:00.000Z');
    const prisma = {
      $queryRawTyped: jest.fn().mockResolvedValue([]),
      retentionAccessLog: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    await disposeDueRetentionAccessLogs(prisma as never, now, { batchSize: 10_000 });

    const calls = prisma.$queryRawTyped.mock.calls as Array<[unknown]>;
    const query = calls[0]?.[0] as { values?: unknown[] } | undefined;
    expect(query?.values?.at(-1)).toBe(500);
  });
});
