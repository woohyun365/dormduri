import { createChatMatchEventOwner } from './chat-match-event-owner.js';
import type { ThreadRecord } from './chat-selects.js';

const now = new Date('2026-02-10T03:00:00.000Z');

function makeThread(overrides: Record<string, unknown> = {}): ThreadRecord {
  return {
    id: 'thread-other',
    seasonId: 'season-1',
    pairKey: 'participant-1:participant-3',
    participantAId: 'participant-1',
    participantBId: 'participant-3',
    openedByParticipantId: 'participant-1',
    threadKind: 'DIRECT',
    activeMatchId: null,
    status: 'OPEN',
    closedReason: null,
    closedAt: null,
    lastMessageAt: new Date('2026-02-10T03:00:00.000Z'),
    createdAt: new Date('2026-02-10T03:00:00.000Z'),
    updatedAt: new Date('2026-02-10T03:00:00.000Z'),
    season: {
      id: 'season-1',
      campusCode: 'CHUNCHEON',
      name: '2026-1',
      preparationStartDate: new Date('2026-02-01T00:00:00.000Z'),
      matchingStartDate: new Date('2026-02-05T00:00:00.000Z'),
      seasonEndDate: new Date('2026-02-28T00:00:00.000Z'),
      overrideState: null,
      overrideReason: null,
      overrideStartedAt: null,
      overrideEndsAt: null,
      dormitoryOperations: [],
    },
    participantA: {
      id: 'participant-1',
      userId: 'user-1',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
    },
    participantB: {
      id: 'participant-3',
      userId: 'user-3',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
    },
    activeMatch: null,
    members: [],
    messages: [],
    ...overrides,
  } as ThreadRecord;
}

type ThreadUpdateManyCall = [
  {
    data: Record<string, unknown>;
  },
];

type OutboxCreateCall = [
  {
    data: {
      eventType: string;
      threadId: string;
      aggregateType: string;
      aggregateId: string;
      payload: Record<string, unknown>;
      occurredAt: Date;
      availableAt: Date;
    };
    select: { id: true };
  },
];

type RecipientCreateManyCall = [
  {
    data: Array<{
      eventId: string;
      userId: string;
      threadId: string;
      cursor: string;
      createdAt: Date;
    }>;
    skipDuplicates: boolean;
  },
];

describe('ChatMatchEventOwner', () => {
  it('ACTIVE 생성으로 닫히는 다른 open direct thread에도 read-only thread.updated outbox를 남긴다', async () => {
    const affectedThread = makeThread();
    const updatedAffectedThread = makeThread({
      status: 'READ_ONLY',
      closedReason: 'ACTIVE_MATCH_CREATED',
      closedAt: now,
    });
    const tx = {
      conversationThread: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([affectedThread])
          .mockResolvedValueOnce([updatedAffectedThread]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      chatRealtimeOutboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-affected' }),
      },
      chatRealtimeEventRecipient: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const owner = createChatMatchEventOwner({
      findThreadRoomSelectionDate: jest.fn().mockReturnValue('2026-02-11'),
      formatKstDate: (date: Date) => date.toISOString().slice(0, 10),
    });

    await owner.handleActiveMatchCreated(
      tx as never,
      {
        seasonId: 'season-1',
        pairKey: 'participant-1:participant-2',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        activeMatchId: 'active-1',
      },
      now,
    );

    const updateManyCalls = tx.conversationThread.updateMany.mock
      .calls as unknown as ThreadUpdateManyCall[];
    const [updateManyArgs] = updateManyCalls[0] ?? [];
    if (!updateManyArgs) {
      throw new Error('thread updateMany args are required');
    }
    expect(updateManyArgs).toMatchObject({
      data: {
        status: 'READ_ONLY',
        closedReason: 'ACTIVE_MATCH_CREATED',
        closedAt: now,
      },
    });

    const outboxCreateCalls = tx.chatRealtimeOutboxEvent.create.mock
      .calls as unknown as OutboxCreateCall[];
    const [outboxCreateArgs] = outboxCreateCalls[0] ?? [];
    if (!outboxCreateArgs) {
      throw new Error('outbox create args are required');
    }
    expect(outboxCreateArgs).toMatchObject({
      data: {
        eventType: 'chat.thread.updated',
        threadId: 'thread-other',
        aggregateType: 'conversation.thread',
        aggregateId: 'thread-other',
        payload: {
          threadId: 'thread-other',
          status: 'READ_ONLY',
          closedReason: 'ACTIVE_MATCH_CREATED',
        },
        occurredAt: now,
        availableAt: now,
      },
      select: { id: true },
    });

    const recipientCreateCalls = tx.chatRealtimeEventRecipient.createMany.mock
      .calls as unknown as RecipientCreateManyCall[];
    const [recipientCreateArgs] = recipientCreateCalls[0] ?? [];
    if (!recipientCreateArgs) {
      throw new Error('recipient createMany args are required');
    }
    expect(recipientCreateArgs.skipDuplicates).toBe(true);
    expect(recipientCreateArgs.data).toEqual(
      expect.arrayContaining([
        {
          eventId: 'event-affected',
          userId: 'user-1',
          threadId: 'thread-other',
          cursor: 'event-affected:user-1',
          createdAt: now,
        },
        {
          eventId: 'event-affected',
          userId: 'user-3',
          threadId: 'thread-other',
          cursor: 'event-affected:user-3',
          createdAt: now,
        },
      ]),
    );
  });

  it('ACTIVE 생성 중 stale candidate가 실제 READ_ONLY로 갱신되지 않았으면 outbox event를 만들지 않는다', async () => {
    const staleCandidate = makeThread();
    const tx = {
      conversationThread: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValueOnce([staleCandidate]).mockResolvedValueOnce([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      chatRealtimeOutboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-stale' }),
      },
      chatRealtimeEventRecipient: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const owner = createChatMatchEventOwner({
      findThreadRoomSelectionDate: jest.fn().mockReturnValue('2026-02-11'),
      formatKstDate: (date: Date) => date.toISOString().slice(0, 10),
    });

    await owner.handleActiveMatchCreated(
      tx as never,
      {
        seasonId: 'season-1',
        pairKey: 'participant-1:participant-2',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        activeMatchId: 'active-1',
      },
      now,
    );

    expect(tx.conversationThread.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ['thread-other'] },
          status: 'OPEN',
        },
      }),
    );
    const findManyCalls = tx.conversationThread.findMany.mock.calls as unknown as Array<
      [{ where: Record<string, unknown> }]
    >;
    expect(findManyCalls[1]?.[0].where).toMatchObject({
      id: { in: ['thread-other'] },
      status: 'READ_ONLY',
      closedReason: 'ACTIVE_MATCH_CREATED',
      closedAt: now,
    });
    expect(tx.chatRealtimeOutboxEvent.create).not.toHaveBeenCalled();
    expect(tx.chatRealtimeEventRecipient.createMany).not.toHaveBeenCalled();
  });

  it('ACTIVE 생성으로 영향을 받는 open direct thread가 2개 이상이면 모두 READ_ONLY update 대상이 된다', async () => {
    const affectedThreads = [
      makeThread({
        id: 'thread-other-a',
        participantB: { ...makeThread().participantB, userId: 'user-3' },
      }),
      makeThread({
        id: 'thread-other-b',
        participantAId: 'participant-4',
        participantBId: 'participant-2',
        participantA: {
          id: 'participant-4',
          userId: 'user-4',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
        participantB: {
          id: 'participant-2',
          userId: 'user-2',
          dormitoryId: 'dasan',
          dormitorySelectionState: 'ASSIGNED',
        },
      }),
    ];
    const updatedThreads = affectedThreads.map((thread) =>
      makeThread({
        ...thread,
        status: 'READ_ONLY',
        closedReason: 'ACTIVE_MATCH_CREATED',
        closedAt: now,
      }),
    );
    const tx = {
      conversationThread: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest
          .fn()
          .mockResolvedValueOnce(affectedThreads)
          .mockResolvedValueOnce(updatedThreads),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      chatRealtimeOutboxEvent: {
        create: jest
          .fn()
          .mockResolvedValueOnce({ id: 'event-thread-other-a' })
          .mockResolvedValueOnce({ id: 'event-thread-other-b' }),
      },
      chatRealtimeEventRecipient: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const owner = createChatMatchEventOwner({
      findThreadRoomSelectionDate: jest.fn().mockReturnValue('2026-02-11'),
      formatKstDate: (date: Date) => date.toISOString().slice(0, 10),
    });

    await owner.handleActiveMatchCreated(
      tx as never,
      {
        seasonId: 'season-1',
        pairKey: 'participant-1:participant-2',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        activeMatchId: 'active-1',
      },
      now,
    );

    expect(tx.conversationThread.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ['thread-other-a', 'thread-other-b'] },
          status: 'OPEN',
        },
        data: {
          status: 'READ_ONLY',
          closedReason: 'ACTIVE_MATCH_CREATED',
          closedAt: now,
        },
      }),
    );
    expect(tx.chatRealtimeOutboxEvent.create).toHaveBeenCalledTimes(2);
    const outboxCreateCalls = tx.chatRealtimeOutboxEvent.create.mock
      .calls as unknown as OutboxCreateCall[];
    expect(outboxCreateCalls.map((call) => call[0].data.threadId)).toEqual([
      'thread-other-a',
      'thread-other-b',
    ]);
  });

  it('기존 pair thread 승격 event와 다른 direct thread read-only event를 같은 match-created transaction에 남긴다', async () => {
    const existingPairThread = makeThread({
      id: 'thread-pair',
      pairKey: 'participant-1:participant-2',
      participantBId: 'participant-2',
      participantB: {
        id: 'participant-2',
        userId: 'user-2',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
    });
    const updatedPairThread = makeThread({
      ...existingPairThread,
      threadKind: 'MATCHED',
      activeMatchId: 'active-1',
      status: 'OPEN',
      closedReason: null,
      closedAt: null,
    });
    const affectedThread = makeThread({ id: 'thread-other' });
    const updatedAffectedThread = makeThread({
      id: 'thread-other',
      status: 'READ_ONLY',
      closedReason: 'ACTIVE_MATCH_CREATED',
      closedAt: now,
    });
    const tx = {
      conversationThread: {
        findFirst: jest.fn().mockResolvedValue(existingPairThread),
        update: jest.fn().mockResolvedValue(updatedPairThread),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([affectedThread])
          .mockResolvedValueOnce([updatedAffectedThread]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      chatRealtimeOutboxEvent: {
        create: jest
          .fn()
          .mockResolvedValueOnce({ id: 'event-pair' })
          .mockResolvedValueOnce({ id: 'event-other' }),
      },
      chatRealtimeEventRecipient: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const owner = createChatMatchEventOwner({
      findThreadRoomSelectionDate: jest.fn().mockReturnValue('2026-02-11'),
      formatKstDate: (date: Date) => date.toISOString().slice(0, 10),
    });

    await owner.handleActiveMatchCreated(
      tx as never,
      {
        seasonId: 'season-1',
        pairKey: 'participant-1:participant-2',
        participantAId: 'participant-1',
        participantBId: 'participant-2',
        activeMatchId: 'active-1',
      },
      now,
    );

    const outboxCreateCalls = tx.chatRealtimeOutboxEvent.create.mock
      .calls as unknown as OutboxCreateCall[];
    const outboxThreadIds = outboxCreateCalls.map((call) => call[0].data.threadId);
    expect(outboxThreadIds).toEqual(['thread-pair', 'thread-other']);
    expect(outboxCreateCalls[0]?.[0]).toMatchObject({
      data: {
        eventType: 'chat.thread.updated',
        threadId: 'thread-pair',
        payload: {
          threadId: 'thread-pair',
          status: 'OPEN',
          closedReason: null,
        },
      },
    });
    expect(outboxCreateCalls[1]?.[0]).toMatchObject({
      data: {
        eventType: 'chat.thread.updated',
        threadId: 'thread-other',
        payload: {
          threadId: 'thread-other',
          status: 'READ_ONLY',
          closedReason: 'ACTIVE_MATCH_CREATED',
        },
      },
    });
  });
});
