type RepositoryConstructor = new (...args: unknown[]) => Record<string, unknown>;

type ChatRealtimeOutboxRepositoryModule = {
  ChatRealtimeOutboxRepository?: RepositoryConstructor;
};

type RawQueryMock = jest.Mock<Promise<unknown[]>, unknown[]>;

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
    const claimedRows = [{ id: 'event-1', eventType: 'chat.message.created' }];
    const queryRaw = jest.fn().mockResolvedValue(claimedRows) as RawQueryMock;
    const queryRawUnsafe = jest.fn().mockResolvedValue(claimedRows) as RawQueryMock;
    const prisma = { $queryRaw: queryRaw, $queryRawUnsafe: queryRawUnsafe };

    await expect(
      claimPublishableBatch.call(repository, prisma, {
        limit: 10,
        now: new Date('2026-02-10T03:00:00.000Z'),
        claimLeaseMs: 30_000,
      }),
    ).resolves.toEqual(claimedRows);

    const rawCalls = [...queryRaw.mock.calls, ...queryRawUnsafe.mock.calls];
    expect(rawCalls).toHaveLength(1);
    const sqlText = sqlTextFromCall(rawCalls[0] ?? []);
    expect(sqlText).toMatch(/UPDATE\s+"ChatRealtimeOutboxEvent"/i);
    expect(sqlText).toMatch(/"publishedAt"\s+IS\s+NULL/i);
    expect(sqlText).toMatch(/"availableAt"\s*<=/i);
    expect(sqlText).toMatch(/ORDER\s+BY[\s\S]*"availableAt"[\s\S]*"occurredAt"[\s\S]*"id"/i);
    expect(sqlText).toMatch(/FOR\s+UPDATE\s+SKIP\s+LOCKED/i);
    expect(sqlText).toMatch(/RETURNING/i);
  });
});
