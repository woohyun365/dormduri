import { createChatSeasonLifecycleOwner } from './chat-season-lifecycle.service.js';
import type { ThreadRecord } from '../persistence/chat-thread.select.js';

const now = new Date('2026-03-01T03:00:00.000Z');

function makeThread(overrides: Record<string, unknown> = {}): ThreadRecord {
  return {
    id: 'thread-1',
    seasonId: 'season-1',
    pairKey: 'participant-1:participant-2',
    participantAId: 'participant-1',
    participantBId: 'participant-2',
    openedByParticipantId: 'participant-1',
    threadKind: 'MATCHED',
    activeMatchId: 'active-1',
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
      id: 'participant-2',
      userId: 'user-2',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
    },
    activeMatch: {
      id: 'active-1',
      participantAId: 'participant-1',
      participantBId: 'participant-2',
      createdFromRequestId: 'request-1',
      startedAt: new Date('2026-02-10T03:00:00.000Z'),
      endedAt: null,
    },
    members: [],
    messages: [],
    ...overrides,
  } as ThreadRecord;
}

function createOutboxCapableTx(updatedThread: ThreadRecord) {
  return {
    conversationThread: {
      update: jest.fn().mockResolvedValue(updatedThread),
    },
    chatRealtimeOutboxEvent: {
      create: jest.fn().mockResolvedValue({ id: 'event-1' }),
    },
    chatRealtimeEventRecipient: {
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
  };
}

type ThreadUpdateCall = [
  {
    where: { id: string };
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
    data: Array<{ eventId: string; userId: string; threadId: string }>;
    skipDuplicates: boolean;
  },
];

describe('ChatSeasonLifecycleOwner', () => {
  it('resolveThreadLifecycleSnapshot은 read path에서 mutation 없이 계산된 상태만 반환한다', async () => {
    const thread = makeThread();
    const prisma = {
      conversationThread: {
        update: jest.fn(),
      },
    };
    const owner = createChatSeasonLifecycleOwner({
      prisma: prisma as never,
      seasonsService: {
        getCurrentSeasonContext: jest.fn().mockResolvedValue({ season: { id: 'season-1' } }),
      } as never,
      findThreadRoomSelectionDate: jest.fn().mockReturnValue(null),
    });

    await expect(owner.resolveThreadLifecycleSnapshot(thread, now)).resolves.toMatchObject({
      id: 'thread-1',
      status: 'READ_ONLY',
      closedReason: 'SEASON_ENDED',
      closedAt: now,
    });
    expect(prisma.conversationThread.update).not.toHaveBeenCalled();
  });

  it('season end로 MATCHED thread가 READ_ONLY가 되면 동일 mutation 경계에서 thread.updated outbox를 남긴다', async () => {
    const thread = makeThread();
    const updatedThread = makeThread({
      status: 'READ_ONLY',
      closedReason: 'SEASON_ENDED',
      closedAt: now,
    });
    const tx = createOutboxCapableTx(updatedThread);
    const seasonsService = {
      getCurrentSeasonContext: jest.fn().mockResolvedValue({ season: { id: 'season-1' } }),
    };
    const owner = createChatSeasonLifecycleOwner({
      prisma: {} as never,
      seasonsService: seasonsService as never,
      findThreadRoomSelectionDate: jest.fn().mockReturnValue(null),
    });

    await expect(owner.synchronizeThreadLifecycle(thread, now, tx as never)).resolves.toBe(
      updatedThread,
    );

    const threadUpdateCalls = tx.conversationThread.update.mock
      .calls as unknown as ThreadUpdateCall[];
    const [threadUpdateArgs] = threadUpdateCalls[0] ?? [];
    if (!threadUpdateArgs) {
      throw new Error('thread update args are required');
    }
    expect(threadUpdateArgs).toMatchObject({
      where: { id: 'thread-1' },
      data: {
        status: 'READ_ONLY',
        closedReason: 'SEASON_ENDED',
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
        threadId: 'thread-1',
        aggregateType: 'conversation.thread',
        aggregateId: 'thread-1',
        payload: {
          threadId: 'thread-1',
          status: 'READ_ONLY',
          closedReason: 'SEASON_ENDED',
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
        expect.objectContaining({ eventId: 'event-1', userId: 'user-1', threadId: 'thread-1' }),
        expect.objectContaining({ eventId: 'event-1', userId: 'user-2', threadId: 'thread-1' }),
      ]),
    );
  });

  it('새 current season이 열리면 visible thread archive와 thread.archived outbox가 모순 없이 함께 남는다', async () => {
    const thread = makeThread({
      status: 'READ_ONLY',
      closedReason: 'SEASON_ENDED',
      closedAt: new Date('2026-02-28T03:00:00.000Z'),
    });
    const updatedThread = makeThread({
      status: 'ARCHIVED',
      closedReason: 'SEASON_ENDED',
      closedAt: new Date('2026-02-28T03:00:00.000Z'),
    });
    const tx = createOutboxCapableTx(updatedThread);
    const owner = createChatSeasonLifecycleOwner({
      prisma: {} as never,
      seasonsService: {
        getCurrentSeasonContext: jest.fn().mockResolvedValue({ season: { id: 'season-2' } }),
      } as never,
      findThreadRoomSelectionDate: jest.fn().mockReturnValue(null),
    });

    await expect(owner.synchronizeThreadLifecycle(thread, now, tx as never)).resolves.toBe(
      updatedThread,
    );

    const threadUpdateCalls = tx.conversationThread.update.mock
      .calls as unknown as ThreadUpdateCall[];
    const [threadUpdateArgs] = threadUpdateCalls[0] ?? [];
    if (!threadUpdateArgs) {
      throw new Error('thread update args are required');
    }
    expect(threadUpdateArgs).toMatchObject({
      where: { id: 'thread-1' },
      data: {
        status: 'ARCHIVED',
        closedReason: 'SEASON_ENDED',
        closedAt: new Date('2026-02-28T03:00:00.000Z'),
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
        eventType: 'chat.thread.archived',
        threadId: 'thread-1',
        aggregateType: 'conversation.thread',
        aggregateId: 'thread-1',
        payload: {
          threadId: 'thread-1',
          closedAt: '2026-02-28T03:00:00.000Z',
          closedReason: 'SEASON_ENDED',
        },
      },
      select: { id: true },
    });
  });
});
