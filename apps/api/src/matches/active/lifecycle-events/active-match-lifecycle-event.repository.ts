import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { ActiveMatchLifecycleEventCreateInput } from './active-match-lifecycle-event.types.js';

@Injectable()
export class ActiveMatchLifecycleEventRepository {
  async create(tx: Prisma.TransactionClient, input: ActiveMatchLifecycleEventCreateInput) {
    return tx.activeMatchLifecycleEvent.create({
      data: {
        activeMatchId: input.activeMatchId,
        eventType: input.eventType,
        reason: input.reason,
        actorType: input.actorType,
        actorUserId: input.actorUserId,
        sourceMatchRequestId: input.sourceMatchRequestId,
        sourceUnmatchRequestId: input.sourceUnmatchRequestId,
        metadata: input.metadata,
        occurredAt: input.occurredAt,
      },
    });
  }
}
