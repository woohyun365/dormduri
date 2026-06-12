import { describe, expect, it, vi } from 'vitest';
import { NotificationOutboxRepository } from './notification-outbox.repository.js';

type TypedSqlLike = {
  sql: string;
  values: readonly unknown[];
};

type NotificationOutboxUpdateCall = [
  {
    where: { id: string };
    data: {
      status?: string;
      lockedAt?: Date | null;
      lockedBy?: string | null;
      lastError?: string;
    };
  },
];

describe('NotificationOutboxRepository', () => {
  it('publishable event claim은 SKIP LOCKED와 status/availableAt guard를 사용한다', async () => {
    const repository = new NotificationOutboxRepository();
    const queryRawTyped = vi.fn<(arg0: TypedSqlLike) => Promise<unknown[]>>().mockResolvedValue([]);
    const now = new Date('2026-06-02T00:00:00.000Z');

    await repository.claimPublishableBatch({ $queryRawTyped: queryRawTyped } as never, {
      limit: 200,
      now,
      claimLeaseMs: 30_000,
      lockedBy: 'test-dispatcher',
    });

    const sqlArg = queryRawTyped.mock.calls[0]?.[0];
    const sqlText = sqlArg?.sql ?? '';
    expect(sqlText).toMatch(/UPDATE\s+"NotificationOutboxEvent"/i);
    expect(sqlText).toMatch(/"status"\s+IN\s+\('PENDING',\s*'FAILED'\)/i);
    expect(sqlText).toMatch(/FOR UPDATE SKIP LOCKED/i);
    expect(sqlText).toMatch(/LIMIT\s+\$4/i);
    expect(sqlArg?.values).toHaveLength(4);
  });

  it('markPublished와 markPublishFailed는 dispatcher가 상태 전이를 소유한다', async () => {
    const repository = new NotificationOutboxRepository();
    const update = vi.fn<(arg0: unknown) => Promise<unknown>>().mockResolvedValue({});
    const now = new Date('2026-06-02T00:00:00.000Z');

    await repository.markPublished(
      { notificationOutboxEvent: { update } },
      {
        eventId: 'event-1',
        now,
      },
    );
    await repository.markPublishFailed(
      { notificationOutboxEvent: { update } },
      {
        eventId: 'event-2',
        now,
        nextAvailableAt: new Date('2026-06-02T00:00:01.000Z'),
        error: 'x'.repeat(2_000),
      },
    );

    const [publishedCall, failedCall] = update.mock.calls as NotificationOutboxUpdateCall[];
    expect(publishedCall?.[0]).toMatchObject({
      where: { id: 'event-1' },
      data: { status: 'PUBLISHED', lockedAt: null, lockedBy: null },
    });
    expect(failedCall?.[0]).toMatchObject({
      where: { id: 'event-2' },
      data: { status: 'FAILED', lockedAt: null, lockedBy: null },
    });
    expect(failedCall?.[0].data.lastError).toMatch(/^x{1000}$/);
  });
});
