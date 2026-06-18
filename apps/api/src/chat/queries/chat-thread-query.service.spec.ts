import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatErrors } from '../errors/chat.errors.js';
import {
  createChatServiceSpecHarness,
  makeThread,
  type ChatServiceSpecHarness,
} from '../test-support/chat-service-spec.harness.js';
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
    const findMany = vi.fn<(arg0: ThreadListFindManyInput) => Promise<ThreadListFindManyRow[]>>();
    findMany.mockResolvedValue([
      { id: 'thread-2', messages: undefined },
      { id: 'thread-1', messages: undefined },
      { id: 'thread-overfetch', messages: undefined },
    ]);
    const prisma = {
      seasonParticipant: {
        findMany: vi
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
    const findMany = vi.fn<(arg0: ThreadListFindManyInput) => Promise<ThreadListFindManyRow[]>>();
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
    const count = vi.fn().mockResolvedValue(1);
    const prisma = {
      conversationThread: {
        count,
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      chatRealtimeOutboxEvent: {
        create: vi.fn(),
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
        count: vi.fn().mockResolvedValue(0),
      },
    };
    const owner = createChatThreadQueryService(prisma as never);

    await expect(owner.canSubscribeThreadForViewer('user-1', 'thread-1')).resolves.toBe(false);
  });

  it('conversation stats는 thread row 기준 시즌별 unique counterpart 수를 계산하고 message payload를 읽지 않는다', async () => {
    const findMany =
      vi.fn<(arg0: Record<string, unknown>) => Promise<ConversationStatsFindManyRow[]>>();
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
        findMany: vi
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
        findMany: vi.fn().mockResolvedValue([]),
      },
      conversationThread: {
        findMany: vi.fn(),
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

describe('chat thread query regression', () => {
  let prisma: ChatServiceSpecHarness['prisma'];
  let seasonsService: ChatServiceSpecHarness['seasonsService'];
  let service: ChatServiceSpecHarness['service'];

  beforeEach(() => {
    const harness = createChatServiceSpecHarness();
    ({ prisma, seasonsService, service } = harness);
  });

  it('listThreads는 bounded pageInfo cursor를 반환하고 read path lifecycle mutation을 만들지 않는다', async () => {
    prisma.conversationThread.findMany.mockResolvedValue(
      Array.from({ length: 21 }, (_, index) =>
        makeThread({
          id: `thread-${String(index).padStart(2, '0')}`,
          createdAt: new Date(
            `2026-02-${String(10 - Math.floor(index / 3)).padStart(2, '0')}T03:00:00.000Z`,
          ),
          lastMessageAt: new Date(
            `2026-02-${String(10 - Math.floor(index / 3)).padStart(2, '0')}T04:00:00.000Z`,
          ),
        }),
      ),
    );

    const result = await service.listThreads(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      { limit: 20 },
    );

    expect(result.items).toHaveLength(20);
    expect(result.pageInfo.hasNextPage).toBe(true);
    expect(typeof result.pageInfo.nextCursor).toBe('string');
    expect(prisma.conversationThread.update).not.toHaveBeenCalled();

    const nextCursor = result.pageInfo.nextCursor;
    if (!nextCursor) {
      throw new Error('Expected next cursor');
    }

    prisma.conversationThread.findMany.mockResolvedValueOnce([]);
    await expect(
      service.listThreads(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        { cursor: nextCursor, limit: 20 },
      ),
    ).resolves.toEqual({
      items: [],
      pageInfo: {
        hasNextPage: false,
        nextCursor: null,
      },
    });
  });
  it('listThreads는 tampered/expired cursor를 bad request로 거절한다', async () => {
    await expect(
      service.listThreads(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        { cursor: 'not-a-valid-cursor' },
      ),
    ).rejects.toMatchObject({
      response: { code: 'CHAT_THREAD_LIST_CURSOR_INVALID' },
    });

    expect(prisma.conversationThread.findMany).not.toHaveBeenCalled();
  });
  it('thread detail은 lifecycle sync 결과 ARCHIVED가 된 thread를 not found로 숨긴다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeThread({
        status: 'READ_ONLY',
        closedReason: 'SEASON_ENDED',
        messages: [
          {
            id: 'message-1',
            body: '지난 시즌 메시지',
            sentAt: new Date('2026-02-10T03:00:00.000Z'),
            senderParticipant: { userId: 'user-1' },
          },
        ],
      }),
    );
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-2' },
      state: 'SEASON_OPEN',
      operatedDormitories: [
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2027-01-11' },
      ],
      schedule: {
        preparationStart: '2027-01-01',
        matchingStart: '2027-01-05',
        matchingEnd: '2027-01-11',
        seasonEnd: '2027-01-28',
      },
    });
    prisma.conversationThread.update.mockResolvedValue(
      makeThread({
        status: 'ARCHIVED',
        closedReason: 'SEASON_ENDED',
        closedAt: new Date('2026-02-10T03:00:00.000Z'),
        messages: [],
      }),
    );

    await expect(
      service.getThreadDetail(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'thread-1',
      ),
    ).rejects.toMatchObject({
      response: chatErrors.threadNotFound().getResponse(),
    });
    expect(prisma.conversationThread.update).not.toHaveBeenCalled();
  });
  it.each([
    {
      threadKind: 'DIRECT' as const,
      activeMatchId: null,
      activeMatch: null,
      closedReason: 'ROOM_SELECTION_CUTOFF' as const,
    },
    {
      threadKind: 'MATCHED' as const,
      activeMatchId: 'active-1',
      activeMatch: {
        id: 'active-1',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        createdFromRequestId: 'request-1',
        startedAt: new Date('2026-02-10T03:00:00.000Z'),
        endedAt: null,
      },
      closedReason: 'SEASON_ENDED' as const,
    },
  ])(
    '다음 시즌 seasonOpenDate 직전까지 지난 시즌 $threadKind read-only thread는 목록에 남아 있다',
    async ({ threadKind, activeMatchId, activeMatch, closedReason }) => {
      prisma.conversationThread.findMany.mockResolvedValue([
        makeThread({
          threadKind,
          activeMatchId,
          activeMatch,
          status: 'READ_ONLY',
          closedReason,
          season: {
            ...makeThread().season,
            seasonEndDate: new Date('2026-08-31T00:00:00.000Z'),
          },
        }),
      ]);
      seasonsService.getCurrentSeasonContext.mockImplementation((_campus: string, now: Date) =>
        Promise.resolve(
          now.getTime() >= new Date('2027-01-01T00:00:00+09:00').getTime()
            ? {
                season: { id: 'season-2' },
                state: 'SEASON_OPEN',
                operatedDormitories: [
                  { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2027-01-11' },
                ],
                schedule: {
                  preparationStart: '2027-01-01',
                  matchingStart: '2027-01-05',
                  matchingEnd: '2027-01-11',
                  seasonEnd: '2027-01-28',
                },
              }
            : null,
        ),
      );
      prisma.getDatabaseNow.mockResolvedValueOnce(new Date('2026-12-31T14:59:59.000Z'));

      const result = await service.listThreads({
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        threadKind,
        status: 'READ_ONLY',
        canSendMessage: false,
        sendMessageUnavailableReason:
          closedReason === 'SEASON_ENDED' ? 'SEASON_ENDED' : 'THREAD_READ_ONLY',
      });
    },
  );
  it.each([
    {
      threadKind: 'DIRECT' as const,
      activeMatchId: null,
      activeMatch: null,
      closedReason: 'ROOM_SELECTION_CUTOFF' as const,
    },
    {
      threadKind: 'MATCHED' as const,
      activeMatchId: 'active-1',
      activeMatch: {
        id: 'active-1',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        createdFromRequestId: 'request-1',
        startedAt: new Date('2026-02-10T03:00:00.000Z'),
        endedAt: null,
      },
      closedReason: 'SEASON_ENDED' as const,
    },
  ])(
    '다음 시즌 seasonOpenDate 00:00:00(KST)가 되면 지난 시즌 $threadKind thread는 archive되어 목록에서 사라진다',
    async ({ threadKind, activeMatchId, activeMatch, closedReason }) => {
      prisma.conversationThread.findMany.mockResolvedValue([
        makeThread({
          threadKind,
          activeMatchId,
          activeMatch,
          status: 'READ_ONLY',
          closedReason,
        }),
      ]);
      prisma.conversationThread.update.mockResolvedValue(
        makeThread({
          threadKind,
          activeMatchId,
          activeMatch,
          status: 'ARCHIVED',
          closedReason: 'SEASON_ENDED',
        }),
      );
      seasonsService.getCurrentSeasonContext.mockResolvedValue({
        season: { id: 'season-2' },
        state: 'SEASON_OPEN',
        operatedDormitories: [
          { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2027-01-11' },
        ],
        schedule: {
          preparationStart: '2027-01-01',
          matchingStart: '2027-01-05',
          matchingEnd: '2027-01-11',
          seasonEnd: '2027-01-28',
        },
      });
      prisma.getDatabaseNow.mockResolvedValueOnce(new Date('2026-12-31T15:00:00.000Z'));

      const result = await service.listThreads({
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      });

      expect(result.items).toEqual([]);
      expect(prisma.conversationThread.update).not.toHaveBeenCalled();
    },
  );
  it('thread participant가 아닌 다른 auth user는 thread detail 접근이 막힌다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(null);

    await expect(
      service.getThreadDetail(
        {
          id: 'user-3',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'thread-1',
      ),
    ).rejects.toMatchObject({
      response: chatErrors.threadNotFound().getResponse(),
    });
  });
});
