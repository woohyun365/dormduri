import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ConversationThreadLifecycleEventCreateInput } from './conversation-thread-lifecycle-event.types.js';

export const conversationThreadLifecycleEventSelect = {
  id: true,
  threadId: true,
  eventType: true,
  reason: true,
  occurredAt: true,
} satisfies Prisma.ConversationThreadLifecycleEventSelect;

@Injectable()
export class ConversationThreadLifecycleEventRepository {
  async create(tx: Prisma.TransactionClient, input: ConversationThreadLifecycleEventCreateInput) {
    return tx.conversationThreadLifecycleEvent.create({
      data: {
        threadId: input.threadId,
        eventType: input.eventType,
        reason: input.reason,
        actorType: input.actorType,
        actorUserId: input.actorUserId,
        sourceDomain: input.sourceDomain,
        sourceActiveMatchId: input.sourceActiveMatchId,
        sourceMatchRequestId: input.sourceMatchRequestId,
        sourceUnmatchRequestId: input.sourceUnmatchRequestId,
        sourceBlockId: input.sourceBlockId,
        sourceReportCaseId: input.sourceReportCaseId,
        sourceArchiveJobId: input.sourceArchiveJobId,
        metadata: input.metadata,
        occurredAt: input.occurredAt,
      },
      select: conversationThreadLifecycleEventSelect,
    });
  }
}
