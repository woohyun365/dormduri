import {
  ConversationThreadLifecycleEventReason,
  ConversationThreadLifecycleEventType,
  ConversationThreadLifecycleSourceDomain,
} from '../../generated/prisma/enums.js';
import type { ConversationThreadLifecycleEventAppendInput } from '../lifecycle-events/conversation-thread-lifecycle-event.types.js';
import { ChatBlockSideEffectService } from './chat-block-side-effect.service.js';

const occurredAt = new Date('2026-06-01T00:00:00.000Z');

function thread(overrides: Record<string, unknown> = {}) {
  return {
    id: 'thread-1',
    seasonId: 'season-1',
    pairKey: 'participant-blocked:participant-blocker',
    participantAId: 'participant-blocked',
    participantBId: 'participant-blocker',
    openedByParticipantId: 'participant-blocker',
    threadKind: 'DIRECT',
    activeMatchId: null,
    status: 'READ_ONLY',
    closedReason: 'USER_BLOCKED',
    closedAt: occurredAt,
    lastMessageAt: null,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    season: {},
    participantA: {
      id: 'participant-blocked',
      userId: 'user-blocked',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
    },
    participantB: {
      id: 'participant-blocker',
      userId: 'user-blocker',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
    },
    activeMatch: null,
    members: [],
    messages: [],
    ...overrides,
  };
}

function createTx(
  input: { candidates?: unknown[]; participants?: unknown[]; updated?: unknown[] } = {},
) {
  const participants = input.participants ?? [
    { id: 'participant-blocker', userId: 'user-blocker' },
    { id: 'participant-blocked', userId: 'user-blocked' },
  ];
  const candidateThreads = input.candidates ?? [{ id: 'thread-1' }];
  const updatedThreads = input.updated ?? [thread()];

  return {
    seasonParticipant: {
      findMany: jest.fn<Promise<unknown[]>, [unknown]>().mockResolvedValue(participants),
    },
    conversationThread: {
      findMany: jest
        .fn<Promise<unknown[]>, [unknown]>()
        .mockResolvedValueOnce(candidateThreads)
        .mockResolvedValueOnce(updatedThreads),
      updateMany: jest.fn<Promise<{ count: number }>, [unknown]>().mockResolvedValue({
        count: updatedThreads.length,
      }),
    },
    chatRealtimeOutboxEvent: {
      create: jest.fn<Promise<{ id: string }>, [unknown]>().mockResolvedValue({ id: 'event-1' }),
    },
    chatRealtimeEventRecipient: {
      createMany: jest.fn<Promise<{ count: number }>, [unknown]>().mockResolvedValue({ count: 2 }),
    },
  };
}

describe('ChatBlockSideEffectService', () => {
  let lifecycleEventAppend: jest.Mock<Promise<unknown>, [unknown, unknown]>;
  let service: ChatBlockSideEffectService;

  beforeEach(() => {
    lifecycleEventAppend = jest.fn<Promise<unknown>, [unknown, unknown]>().mockResolvedValue({
      id: 'thread-lifecycle-event-1',
    });
    service = new ChatBlockSideEffectService({ append: lifecycleEventAppend });
  });

  it('block으로 닫힌 direct thread에 USER_BLOCKED lifecycle event를 같은 tx로 append한다', async () => {
    const tx = createTx();

    await expect(
      service.closeDirectThreadsForBlock(tx as never, {
        seasonId: 'season-1',
        blockerUserId: 'user-blocker',
        blockedUserId: 'user-blocked',
        sourceBlockId: 'block-1',
        occurredAt,
      }),
    ).resolves.toEqual({ closedThreadIds: ['thread-1'] });

    expect(tx.conversationThread.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['thread-1'] },
        status: 'OPEN',
        threadKind: 'DIRECT',
        activeMatchId: null,
      },
      data: {
        status: 'READ_ONLY',
        closedReason: 'USER_BLOCKED',
        closedAt: occurredAt,
      },
    });
    const lifecycleAppendCalls = lifecycleEventAppend.mock.calls as Array<
      [unknown, ConversationThreadLifecycleEventAppendInput]
    >;
    const [lifecycleTx, lifecycleInput] = lifecycleAppendCalls[0] ?? [];
    expect(lifecycleTx).toBe(tx);
    expect(lifecycleInput).toMatchObject({
      threadId: 'thread-1',
      eventType: ConversationThreadLifecycleEventType.THREAD_READ_ONLY,
      reason: ConversationThreadLifecycleEventReason.USER_BLOCKED,
      sourceDomain: ConversationThreadLifecycleSourceDomain.SOCIAL_SAFETY,
      sourceBlockId: 'block-1',
      occurredAt,
      metadata: {
        previousStatus: 'OPEN',
        nextStatus: 'READ_ONLY',
        previousClosedReason: null,
        nextClosedReason: 'USER_BLOCKED',
      },
    });
  });

  it('participant나 target thread가 없으면 lifecycle event를 append하지 않는다', async () => {
    const missingParticipantTx = createTx({ participants: [] });
    await expect(
      service.closeDirectThreadsForBlock(missingParticipantTx as never, {
        seasonId: 'season-1',
        blockerUserId: 'user-blocker',
        blockedUserId: 'user-blocked',
        sourceBlockId: 'block-1',
        occurredAt,
      }),
    ).resolves.toEqual({ closedThreadIds: [] });

    const noThreadTx = createTx({ candidates: [], updated: [] });
    await expect(
      service.closeDirectThreadsForBlock(noThreadTx as never, {
        seasonId: 'season-1',
        blockerUserId: 'user-blocker',
        blockedUserId: 'user-blocked',
        sourceBlockId: 'block-1',
        occurredAt,
      }),
    ).resolves.toEqual({ closedThreadIds: [] });

    expect(lifecycleEventAppend).not.toHaveBeenCalled();
  });
});
