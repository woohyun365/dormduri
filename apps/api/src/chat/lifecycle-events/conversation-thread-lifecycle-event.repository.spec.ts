import type { Prisma } from '../../generated/prisma/client.js';
import {
  ConversationThreadLifecycleActorType,
  ConversationThreadLifecycleEventReason,
  ConversationThreadLifecycleEventType,
  ConversationThreadLifecycleSourceDomain,
} from '../../generated/prisma/enums.js';
import {
  conversationThreadLifecycleEventSelect,
  ConversationThreadLifecycleEventRepository,
} from './conversation-thread-lifecycle-event.repository.js';

const occurredAt = new Date('2026-02-10T03:00:00.000Z');

describe('ConversationThreadLifecycleEventRepository', () => {
  it('caller-provided transaction client로 lifecycle event를 append한다', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'event-1',
      threadId: 'thread-1',
      eventType: ConversationThreadLifecycleEventType.THREAD_READ_ONLY,
      reason: ConversationThreadLifecycleEventReason.USER_BLOCKED,
      occurredAt,
    });
    const tx = {
      conversationThreadLifecycleEvent: { create },
    } as unknown as Prisma.TransactionClient;
    const repository = new ConversationThreadLifecycleEventRepository();

    await repository.create(tx, {
      threadId: 'thread-1',
      eventType: ConversationThreadLifecycleEventType.THREAD_READ_ONLY,
      reason: ConversationThreadLifecycleEventReason.USER_BLOCKED,
      actorType: ConversationThreadLifecycleActorType.SYSTEM,
      sourceDomain: ConversationThreadLifecycleSourceDomain.SOCIAL_SAFETY,
      sourceBlockId: 'block-1',
      metadata: {
        previousStatus: 'OPEN',
        nextStatus: 'READ_ONLY',
      },
      occurredAt,
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        threadId: 'thread-1',
        eventType: ConversationThreadLifecycleEventType.THREAD_READ_ONLY,
        reason: ConversationThreadLifecycleEventReason.USER_BLOCKED,
        actorType: ConversationThreadLifecycleActorType.SYSTEM,
        actorUserId: undefined,
        sourceDomain: ConversationThreadLifecycleSourceDomain.SOCIAL_SAFETY,
        sourceActiveMatchId: undefined,
        sourceMatchRequestId: undefined,
        sourceUnmatchRequestId: undefined,
        sourceBlockId: 'block-1',
        sourceReportCaseId: undefined,
        sourceArchiveJobId: undefined,
        metadata: {
          previousStatus: 'OPEN',
          nextStatus: 'READ_ONLY',
        },
        occurredAt,
      },
      select: conversationThreadLifecycleEventSelect,
    });
  });
});
