import { createChatQueryOwner } from './chat-query-owner.js';

type ThreadListFindManyInput = {
  orderBy?: unknown;
  select?: { messages?: unknown };
  take?: number;
  where?: { OR?: unknown };
};

type ThreadListFindManyRow = {
  id: string;
  messages?: unknown;
};

describe('ChatQueryOwner', () => {
  it('thread list는 bounded pagination과 deterministic order를 사용하고 message payload를 가져오지 않는다', async () => {
    const findMany = jest.fn<Promise<ThreadListFindManyRow[]>, [ThreadListFindManyInput]>();
    findMany.mockResolvedValue([
      { id: 'thread-2', messages: undefined },
      { id: 'thread-1', messages: undefined },
      { id: 'thread-overfetch', messages: undefined },
    ]);
    const prisma = {
      conversationThread: {
        findMany,
      },
    };
    const owner = createChatQueryOwner(prisma as never);

    const result = await owner.findThreadsForViewer('user-1', { limit: 2, after: null });

    expect(result).toMatchObject({
      hasNextPage: true,
      items: [
        { id: 'thread-2', messages: [] },
        { id: 'thread-1', messages: [] },
      ],
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
        orderBy: [
          { lastMessageAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
      }),
    );
    const query = findMany.mock.calls[0]?.[0] as unknown as {
      select?: { messages?: unknown };
    };
    expect(query.select?.messages).toBe(false);
  });

  it('thread list cursor는 lastMessageAt/createdAt/id tie-breaker로 다음 page만 조회한다', async () => {
    const findMany = jest.fn<Promise<ThreadListFindManyRow[]>, [ThreadListFindManyInput]>();
    findMany.mockResolvedValue([]);
    const prisma = {
      conversationThread: {
        findMany,
      },
    };
    const owner = createChatQueryOwner(prisma as never);

    await owner.findThreadsForViewer('user-1', {
      limit: 20,
      after: {
        lastMessageAt: new Date('2026-02-10T02:00:00.000Z'),
        createdAt: new Date('2026-02-09T02:00:00.000Z'),
        threadId: 'thread-1',
      },
    });

    const query = findMany.mock.calls[0]?.[0] as unknown as {
      where?: { OR?: unknown };
    };
    expect(query.where?.OR).toEqual([
      { lastMessageAt: { lt: new Date('2026-02-10T02:00:00.000Z') } },
      { lastMessageAt: null },
      {
        lastMessageAt: new Date('2026-02-10T02:00:00.000Z'),
        createdAt: { lt: new Date('2026-02-09T02:00:00.000Z') },
      },
      {
        lastMessageAt: new Date('2026-02-10T02:00:00.000Z'),
        createdAt: new Date('2026-02-09T02:00:00.000Z'),
        id: { lt: 'thread-1' },
      },
    ]);
  });

  it('subscribe authorization은 ACTIVE member와 non-archived thread만 pure count query로 확인한다', async () => {
    const count = jest.fn().mockResolvedValue(1);
    const prisma = {
      conversationThread: {
        count,
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      chatRealtimeOutboxEvent: {
        create: jest.fn(),
      },
    };
    const owner = createChatQueryOwner(prisma as never);

    await expect(owner.canSubscribeThreadForViewer('user-1', 'thread-1')).resolves.toBe(true);

    expect(count).toHaveBeenCalledWith({
      where: {
        id: 'thread-1',
        status: { in: ['OPEN', 'READ_ONLY'] },
        members: {
          some: {
            memberState: 'ACTIVE',
            participant: {
              userId: 'user-1',
              hiddenByAdminAt: null,
              deactivatedAt: null,
              user: {
                deletedAt: null,
              },
            },
          },
        },
      },
    });
    expect(prisma.conversationThread.update).not.toHaveBeenCalled();
    expect(prisma.conversationThread.updateMany).not.toHaveBeenCalled();
    expect(prisma.chatRealtimeOutboxEvent.create).not.toHaveBeenCalled();
  });

  it('subscribe authorization count가 0이면 archived/left/deleted/inactive 상태를 fail-closed로 거절한다', async () => {
    const prisma = {
      conversationThread: {
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const owner = createChatQueryOwner(prisma as never);

    await expect(owner.canSubscribeThreadForViewer('user-1', 'thread-1')).resolves.toBe(false);
  });
});
