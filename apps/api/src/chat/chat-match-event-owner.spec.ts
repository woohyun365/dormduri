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
    const tx = {
      conversationThread: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([affectedThread]),
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
});
