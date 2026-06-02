type RepositoryConstructor = new (...args: unknown[]) => Record<string, unknown>;

type ChatRealtimeOutboxRepositoryModule = {
  ChatRealtimeOutboxRepository?: RepositoryConstructor;
};

type TypedQueryMock = jest.Mock<Promise<unknown[]>, unknown[]>;

async function loadOutboxRepositoryModule(): Promise<ChatRealtimeOutboxRepositoryModule> {
  const modulePath = './chat-realtime-outbox.repository.js';
  return (await import(modulePath)) as ChatRealtimeOutboxRepositoryModule;
}

function getMethod<T extends (...args: unknown[]) => unknown>(
  owner: Record<string, unknown>,
  methodName: string,
): T {
  const method = owner[methodName];
  expect(method).toEqual(expect.any(Function));
  return method as T;
}

function sqlTextFromCall(call: unknown[]) {
  const [first] = call;
  if (typeof first === 'string') {
    return first;
  }
  if (Array.isArray(first) && 'raw' in first) {
    return (first.raw as readonly string[]).join('?');
  }
  if (first && typeof first === 'object') {
    const sql = (first as { sql?: unknown }).sql;
    if (typeof sql === 'string') {
      return sql;
    }
  }
  return JSON.stringify(first);
}

describe('ChatRealtimeOutboxRepository red contract', () => {
  it('publishable event claim은 단일 DB statement에서 FOR UPDATE SKIP LOCKED로 중복 claim을 방지한다', async () => {
    const { ChatRealtimeOutboxRepository } = await loadOutboxRepositoryModule();
    expect(ChatRealtimeOutboxRepository).toEqual(expect.any(Function));

    if (!ChatRealtimeOutboxRepository) {
      throw new Error('ChatRealtimeOutboxRepository export is required');
    }

    const repository = new ChatRealtimeOutboxRepository();
    const claimPublishableBatch = getMethod<(...args: unknown[]) => Promise<unknown>>(
      repository,
      'claimPublishableBatch',
    );
    const claimedRows = [{ id: 'event-1', eventType: 'chat.message.created', roomKeys: [] }];
    const queryRawTyped = jest.fn().mockResolvedValue(claimedRows) as TypedQueryMock;
    const queryRawUnsafe = jest.fn().mockResolvedValue(claimedRows) as TypedQueryMock;
    const prisma = { $queryRawTyped: queryRawTyped, $queryRawUnsafe: queryRawUnsafe };

    await expect(
      claimPublishableBatch.call(repository, prisma, {
        limit: 10,
        now: new Date('2026-02-10T03:00:00.000Z'),
        claimLeaseMs: 30_000,
      }),
    ).resolves.toEqual(claimedRows);

    const rawCalls = [...queryRawTyped.mock.calls, ...queryRawUnsafe.mock.calls];
    expect(rawCalls).toHaveLength(1);
    const sqlText = sqlTextFromCall(rawCalls[0] ?? []);
    expect(sqlText).toMatch(/UPDATE\s+"ChatRealtimeOutboxEvent"/i);
    expect(sqlText).toMatch(/"publishedAt"\s+IS\s+NULL/i);
    expect(sqlText).toMatch(/"availableAt"\s*<=/i);
    expect(sqlText).toMatch(/ORDER\s+BY[\s\S]*"availableAt"[\s\S]*"occurredAt"[\s\S]*"id"/i);
    expect(sqlText).toMatch(/FOR\s+UPDATE\s+SKIP\s+LOCKED/i);
    expect(sqlText).toMatch(/RETURNING/i);
  });

  it('pruneExpired는 7일 replay window 밖 outbox event를 삭제해 recipient도 cascade 되게 한다', async () => {
    const { ChatRealtimeOutboxRepository } = await loadOutboxRepositoryModule();
    expect(ChatRealtimeOutboxRepository).toEqual(expect.any(Function));

    if (!ChatRealtimeOutboxRepository) {
      throw new Error('ChatRealtimeOutboxRepository export is required');
    }

    const repository = new ChatRealtimeOutboxRepository();
    const pruneExpired = getMethod<(...args: unknown[]) => Promise<unknown>>(
      repository,
      'pruneExpired',
    );
    const queryRawTyped = jest.fn().mockResolvedValue([{ deletedCount: 3 }]) as TypedQueryMock;
    const prisma = { $queryRawTyped: queryRawTyped };

    await expect(
      pruneExpired.call(repository, prisma, {
        now: new Date('2026-02-10T03:00:00.000Z'),
        replayWindowDays: 7,
      }),
    ).resolves.toBe(3);

    const sqlText = sqlTextFromCall(queryRawTyped.mock.calls[0] ?? []);
    expect(sqlText).toMatch(/DELETE\s+FROM\s+"ChatRealtimeOutboxEvent"/i);
    expect(sqlText).toMatch(/"occurredAt"\s+</i);
  });

  it('publish success/failure mark API는 payload를 건드리지 않고 outbox 상태만 갱신한다', async () => {
    const { ChatRealtimeOutboxRepository } = await loadOutboxRepositoryModule();
    expect(ChatRealtimeOutboxRepository).toEqual(expect.any(Function));

    if (!ChatRealtimeOutboxRepository) {
      throw new Error('ChatRealtimeOutboxRepository export is required');
    }

    const repository = new ChatRealtimeOutboxRepository();
    const markPublished = getMethod<(...args: unknown[]) => Promise<unknown>>(
      repository,
      'markPublished',
    );
    const markPublishFailed = getMethod<(...args: unknown[]) => Promise<unknown>>(
      repository,
      'markPublishFailed',
    );
    const update = jest.fn().mockResolvedValue({ id: 'event-1' });
    const prisma = {
      chatRealtimeOutboxEvent: { update },
    };
    const now = new Date('2026-02-10T03:00:00.000Z');

    await markPublished.call(repository, prisma, { eventId: 'event-1', now });
    await markPublishFailed.call(repository, prisma, {
      eventId: 'event-2',
      now,
      nextAvailableAt: new Date('2026-02-10T03:00:02.000Z'),
      error: 'socket publish failed',
    });

    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: 'event-1' },
      data: {
        publishedAt: now,
        lastPublishError: null,
        updatedAt: now,
      },
    });
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: 'event-2' },
      data: {
        availableAt: new Date('2026-02-10T03:00:02.000Z'),
        lastPublishError: 'socket publish failed',
        updatedAt: now,
      },
    });
    expect(JSON.stringify(update.mock.calls)).not.toContain('payload');
  });
});
