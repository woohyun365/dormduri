import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import {
  ActiveMatchLifecycleActorType,
  ActiveMatchLifecycleEventReason,
  ActiveMatchLifecycleEventType,
} from '../../../generated/prisma/enums.js';
import { toActiveMatchLifecycleEventMetadata } from './active-match-lifecycle-event.metadata.js';
import { ActiveMatchLifecycleEventRepository } from './active-match-lifecycle-event.repository.js';
import type {
  ActiveMatchCreatedInput,
  ActiveMatchLifecycleEventCreateInput,
  ActiveMatchLifecycleMetadataInput,
  ActiveMatchSeasonEndedInput,
  ActiveMatchSystemUnmatchRequestInput,
  ActiveMatchUnmatchedInput,
  ActiveMatchUnmatchRequestInput,
} from './active-match-lifecycle-event.types.js';

type ActiveMatchLifecycleWriterRecordInput = Omit<
  ActiveMatchLifecycleEventCreateInput,
  'metadata'
> & {
  metadata?: ActiveMatchLifecycleMetadataInput | null;
};

@Injectable()
export class ActiveMatchLifecycleEventWriter {
  constructor(private readonly repository: ActiveMatchLifecycleEventRepository) {}

  async recordActiveCreated(tx: Prisma.TransactionClient, input: ActiveMatchCreatedInput) {
    return this.record(tx, {
      activeMatchId: input.activeMatchId,
      eventType: ActiveMatchLifecycleEventType.ACTIVE_CREATED,
      reason: ActiveMatchLifecycleEventReason.MATCH_REQUEST_ACCEPTED,
      actorType: ActiveMatchLifecycleActorType.USER,
      actorUserId: input.actorUserId,
      sourceMatchRequestId: input.sourceMatchRequestId,
      occurredAt: input.occurredAt,
      metadata: input.metadata,
    });
  }

  async recordUnmatchRequested(
    tx: Prisma.TransactionClient,
    input: ActiveMatchUnmatchRequestInput,
  ) {
    return this.record(tx, {
      activeMatchId: input.activeMatchId,
      eventType: ActiveMatchLifecycleEventType.UNMATCH_REQUESTED,
      reason: ActiveMatchLifecycleEventReason.USER_REQUESTED_UNMATCH,
      actorType: ActiveMatchLifecycleActorType.USER,
      actorUserId: input.actorUserId,
      sourceUnmatchRequestId: input.sourceUnmatchRequestId,
      occurredAt: input.occurredAt,
      metadata: input.metadata,
    });
  }

  async recordUnmatchRequestCancelled(
    tx: Prisma.TransactionClient,
    input: ActiveMatchUnmatchRequestInput,
  ) {
    return this.record(tx, {
      activeMatchId: input.activeMatchId,
      eventType: ActiveMatchLifecycleEventType.UNMATCH_REQUEST_CANCELLED,
      reason: ActiveMatchLifecycleEventReason.USER_CANCELLED_UNMATCH_REQUEST,
      actorType: ActiveMatchLifecycleActorType.USER,
      actorUserId: input.actorUserId,
      sourceUnmatchRequestId: input.sourceUnmatchRequestId,
      occurredAt: input.occurredAt,
      metadata: input.metadata,
    });
  }

  async recordUnmatchRequestExpired(
    tx: Prisma.TransactionClient,
    input: ActiveMatchSystemUnmatchRequestInput,
  ) {
    return this.record(tx, {
      activeMatchId: input.activeMatchId,
      eventType: ActiveMatchLifecycleEventType.UNMATCH_REQUEST_EXPIRED,
      reason: ActiveMatchLifecycleEventReason.ROOM_SELECTION_CUTOFF,
      actorType: ActiveMatchLifecycleActorType.SYSTEM,
      sourceUnmatchRequestId: input.sourceUnmatchRequestId,
      occurredAt: input.occurredAt,
      metadata: input.metadata,
    });
  }

  async recordUnmatched(tx: Prisma.TransactionClient, input: ActiveMatchUnmatchedInput) {
    return this.record(tx, {
      activeMatchId: input.activeMatchId,
      eventType: ActiveMatchLifecycleEventType.UNMATCHED,
      reason: ActiveMatchLifecycleEventReason.MUTUAL_UNMATCH_CONSENT,
      actorType: ActiveMatchLifecycleActorType.USER,
      actorUserId: input.actorUserId,
      sourceUnmatchRequestId: input.sourceUnmatchRequestId,
      occurredAt: input.occurredAt,
      metadata: input.metadata,
    });
  }

  async recordSeasonEnded(tx: Prisma.TransactionClient, input: ActiveMatchSeasonEndedInput) {
    return this.record(tx, {
      activeMatchId: input.activeMatchId,
      eventType: ActiveMatchLifecycleEventType.SEASON_ENDED,
      reason: ActiveMatchLifecycleEventReason.SEASON_ENDED_SWEEP,
      actorType: ActiveMatchLifecycleActorType.SYSTEM,
      occurredAt: input.occurredAt,
      metadata: input.metadata,
    });
  }

  private async record(tx: Prisma.TransactionClient, input: ActiveMatchLifecycleWriterRecordInput) {
    return this.repository.create(tx, {
      ...input,
      metadata: toActiveMatchLifecycleEventMetadata(input.metadata),
    });
  }
}
