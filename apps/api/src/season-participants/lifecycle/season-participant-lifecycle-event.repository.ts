import type { Prisma } from '../../generated/prisma/client.js';
import type { SeasonParticipantLifecycleEventInput } from './season-participant-lifecycle-event.types.js';

export function createSeasonParticipantLifecycleEventRepository() {
  async function create(tx: Prisma.TransactionClient, input: SeasonParticipantLifecycleEventInput) {
    return tx.seasonParticipantLifecycleEvent.create({
      data: {
        participantId: input.participantId,
        seasonId: input.seasonId,
        userId: input.userId,
        eventType: input.eventType,
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorType,
        reason: input.reason,
        metadata: input.metadata,
        occurredAt: input.occurredAt,
      },
      select: { id: true },
    });
  }

  async function createMany(
    tx: Prisma.TransactionClient,
    inputs: SeasonParticipantLifecycleEventInput[],
  ) {
    if (inputs.length === 0) {
      return { count: 0 };
    }

    return tx.seasonParticipantLifecycleEvent.createMany({
      data: inputs.map((input) => ({
        participantId: input.participantId,
        seasonId: input.seasonId,
        userId: input.userId,
        eventType: input.eventType,
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorType,
        reason: input.reason,
        metadata: input.metadata,
        occurredAt: input.occurredAt,
      })),
    });
  }

  return { create, createMany };
}

export type SeasonParticipantLifecycleEventRepository = ReturnType<
  typeof createSeasonParticipantLifecycleEventRepository
>;
