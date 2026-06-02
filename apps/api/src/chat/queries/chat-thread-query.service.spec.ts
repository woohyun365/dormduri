import { createChatThreadQueryService } from './chat-thread-query.service.js';

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

type ConversationStatsFindManyRow = {
  seasonId: string;
  participantAId: string;
  participantBId: string;
  participantA: { userId: string };
  participantB: { userId: string };
  season: {
    id: string;
    name: string;
    academicYear: number;
    semester: number;
  };
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
      seasonParticipant: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'participant-viewer-current' },
            { id: 'participant-viewer-past' },
          ]),
      },
      conversationThread: {
        findMany,
      },
    };
    const owner = createChatThreadQueryService(prisma as never);

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
    const owner = createChatThreadQueryService(prisma as never);

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
    const owner = createChatThreadQueryService(prisma as never);

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
    const owner = createChatThreadQueryService(prisma as never);

    await expect(owner.canSubscribeThreadForViewer('user-1', 'thread-1')).resolves.toBe(false);
  });

  it('conversation stats는 thread row 기준 시즌별 unique counterpart 수를 계산하고 message payload를 읽지 않는다', async () => {
    const findMany = jest.fn<Promise<ConversationStatsFindManyRow[]>, [Record<string, unknown>]>();
    findMany.mockResolvedValue([
      {
        seasonId: 'season-current',
        participantAId: 'participant-viewer-current',
        participantBId: 'participant-b-current',
        participantA: { userId: 'user-1' },
        participantB: { userId: 'user-b' },
        season: { id: 'season-current', name: '2026-1', academicYear: 2026, semester: 1 },
      },
      {
        seasonId: 'season-current',
        participantAId: 'participant-b-current',
        participantBId: 'participant-viewer-current',
        participantA: { userId: 'user-b' },
        participantB: { userId: 'user-1' },
        season: { id: 'season-current', name: '2026-1', academicYear: 2026, semester: 1 },
      },
      {
        seasonId: 'season-past',
        participantAId: 'participant-viewer-past',
        participantBId: 'participant-c-past',
        participantA: { userId: 'user-1' },
        participantB: { userId: 'user-c' },
        season: { id: 'season-past', name: '2025-2', academicYear: 2025, semester: 2 },
      },
    ]);
    const prisma = {
      seasonParticipant: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'participant-viewer-current' },
            { id: 'participant-viewer-past' },
          ]),
      },
      conversationThread: {
        findMany,
      },
    };
    const owner = createChatThreadQueryService(prisma as never);

    const result = await owner.getConversationStatsForUser({
      userId: 'user-1',
      currentSeason: { id: 'season-current', name: '2026-1' },
    });

    expect(result).toEqual({
      current: {
        seasonId: 'season-current',
        seasonName: '2026-1',
        conversationUserCount: 1,
      },
      past: [
        {
          seasonId: 'season-past',
          seasonName: '2025-2',
          conversationUserCount: 1,
        },
      ],
    });
    expect(prisma.seasonParticipant.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { id: true },
    });
    const query = findMany.mock.calls[0]?.[0] as {
      select?: Record<string, unknown>;
      where?: { OR?: unknown };
    };
    expect(query.where?.OR).toEqual([
      { participantAId: { in: ['participant-viewer-current', 'participant-viewer-past'] } },
      { participantBId: { in: ['participant-viewer-current', 'participant-viewer-past'] } },
    ]);
    expect(query.where).not.toHaveProperty('status');
    expect(query.where).not.toHaveProperty('members');
    expect(query.select).not.toHaveProperty('messages');
  });

  it('conversation stats는 current season이 있으면 thread가 없어도 0 count를 반환한다', async () => {
    const prisma = {
      seasonParticipant: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      conversationThread: {
        findMany: jest.fn(),
      },
    };
    const owner = createChatThreadQueryService(prisma as never);

    await expect(
      owner.getConversationStatsForUser({
        userId: 'user-no-thread',
        currentSeason: { id: 'season-current', name: '2026-1' },
      }),
    ).resolves.toEqual({
      current: {
        seasonId: 'season-current',
        seasonName: '2026-1',
        conversationUserCount: 0,
      },
      past: [],
    });
    expect(prisma.conversationThread.findMany).not.toHaveBeenCalled();
  });
});
