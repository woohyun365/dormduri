import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  ConversationThreadLifecycleEventReason,
  ConversationThreadLifecycleEventType,
  ConversationThreadLifecycleSourceDomain,
} from '../../generated/prisma/enums.js';
import type { ConversationThreadLifecycleEventAppendInput } from '../lifecycle-events/conversation-thread-lifecycle-event.types.js';
import { ChatParticipantWithdrawalService } from './chat-participant-withdrawal.service.js';

const now = new Date('2026-06-01T00:00:00.000Z');

function thread(overrides: Record<string, unknown> = {}) {
  return {
    id: 'thread-1',
    seasonId: 'season-1',
    pairKey: 'pair-1',
    participantAId: 'participant-1',
    participantBId: 'participant-2',
    openedByParticipantId: 'participant-1',
    threadKind: 'DIRECT',
    activeMatchId: null,
    status: 'READ_ONLY',
    closedReason: 'PARTICIPANT_WITHDRAWN',
    closedAt: now,
    lastMessageAt: null,
    createdAt: now,
    updatedAt: now,
    season: {},
    participantA: {
      id: 'participant-1',
      userId: 'user-a',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
    },
    participantB: {
      id: 'participant-2',
      userId: 'user-b',
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
    },
    activeMatch: null,
    members: [],
    messages: [],
    ...overrides,
  };
}

function createTx(input: { candidates?: unknown[]; updated?: unknown[] } = {}) {
  const candidateThreads = input.candidates ?? [thread({ status: 'OPEN', closedReason: null })];
  const updatedThreads = input.updated ?? [thread()];
  const conversationThreadFindMany = vi
    .fn<(arg0: unknown) => Promise<unknown[]>>()
    .mockResolvedValueOnce(candidateThreads)
    .mockResolvedValueOnce(updatedThreads);
  const conversationThreadUpdateMany = vi
    .fn<(arg0: unknown) => Promise<{ count: number }>>()
    .mockResolvedValue({ count: updatedThreads.length });
  const chatRealtimeOutboxEventCreate = vi
    .fn<(arg0: unknown) => Promise<{ id: string }>>()
    .mockResolvedValue({ id: 'event-1' });
  const chatRealtimeEventRecipientCreateMany = vi
    .fn<(arg0: unknown) => Promise<{ count: number }>>()
    .mockResolvedValue({ count: 2 });

  return {
    conversationThread: {
      findMany: conversationThreadFindMany,
      updateMany: conversationThreadUpdateMany,
    },
    chatRealtimeOutboxEvent: {
      create: chatRealtimeOutboxEventCreate,
    },
    chatRealtimeEventRecipient: {
      createMany: chatRealtimeEventRecipientCreateMany,
    },
  };
}

describe('ChatParticipantWithdrawalService', () => {
  let lifecycleEventAppend: Mock<(arg0: unknown, arg1: unknown) => Promise<unknown>>;
  let service: ChatParticipantWithdrawalService;

  beforeEach(() => {
    lifecycleEventAppend = vi
      .fn<(arg0: unknown, arg1: unknown) => Promise<unknown>>()
      .mockResolvedValue({
        id: 'thread-lifecycle-event-1',
      });
    service = new ChatParticipantWithdrawalService({ append: lifecycleEventAppend });
  });

  it('withdrawn participant의 open direct thread를 read-only로 전환하고 outbox event를 append한다', async () => {
    const tx = createTx();

    await expect(
      service.markOpenDirectThreadsReadOnlyForWithdrawnParticipant(tx as never, {
        seasonId: 'season-1',
        participantId: 'participant-1',
        now,
      }),
    ).resolves.toEqual({ updatedThreadIds: ['thread-1'] });

    const firstFindCall = tx.conversationThread.findMany.mock.calls[0]?.[0] as
      | { where: Record<string, unknown> }
      | undefined;
    expect(firstFindCall?.where).toMatchObject({
      seasonId: 'season-1',
      threadKind: 'DIRECT',
      activeMatchId: null,
      status: 'OPEN',
      OR: [{ participantAId: 'participant-1' }, { participantBId: 'participant-1' }],
    });
    expect(tx.conversationThread.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['thread-1'] },
        status: 'OPEN',
        activeMatchId: null,
      },
      data: {
        status: 'READ_ONLY',
        closedReason: 'PARTICIPANT_WITHDRAWN',
        closedAt: now,
      },
    });
    const outboxCreateCall = tx.chatRealtimeOutboxEvent.create.mock.calls[0]?.[0] as
      | { data: Record<string, unknown> }
      | undefined;
    expect(outboxCreateCall?.data).toMatchObject({
      eventType: 'chat.thread.updated',
      threadId: 'thread-1',
      payload: {
        threadId: 'thread-1',
        status: 'READ_ONLY',
        closedReason: 'PARTICIPANT_WITHDRAWN',
      },
      roomKeys: ['user:user-a', 'user:user-b'],
    });

    const recipientCreateCall = tx.chatRealtimeEventRecipient.createMany.mock.calls[0]?.[0] as
      | { data: Array<Record<string, unknown>> }
      | undefined;
    expect(recipientCreateCall?.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: 'user-a', threadId: 'thread-1' }),
        expect.objectContaining({ userId: 'user-b', threadId: 'thread-1' }),
      ]),
    );
    const lifecycleAppendCalls = lifecycleEventAppend.mock.calls as Array<
      [unknown, ConversationThreadLifecycleEventAppendInput]
    >;
    const [lifecycleTx, lifecycleInput] = lifecycleAppendCalls[0] ?? [];
    expect(lifecycleTx).toBe(tx);
    expect(lifecycleInput).toMatchObject({
      threadId: 'thread-1',
      eventType: ConversationThreadLifecycleEventType.THREAD_READ_ONLY,
      reason: ConversationThreadLifecycleEventReason.PARTICIPANT_WITHDRAWN,
      sourceDomain: ConversationThreadLifecycleSourceDomain.SEASON_PARTICIPANTS,
      occurredAt: now,
      metadata: {
        previousStatus: 'OPEN',
        nextStatus: 'READ_ONLY',
        previousClosedReason: null,
        nextClosedReason: 'PARTICIPANT_WITHDRAWN',
      },
    });
  });

  it('대상 open direct thread가 없으면 idempotent no-op이다', async () => {
    const tx = createTx({ candidates: [], updated: [] });

    await expect(
      service.markOpenDirectThreadsReadOnlyForWithdrawnParticipant(tx as never, {
        seasonId: 'season-1',
        participantId: 'participant-1',
        now,
      }),
    ).resolves.toEqual({ updatedThreadIds: [] });

    expect(tx.conversationThread.updateMany).not.toHaveBeenCalled();
    expect(tx.chatRealtimeOutboxEvent.create).not.toHaveBeenCalled();
    expect(lifecycleEventAppend).not.toHaveBeenCalled();
  });
});
