import type { Prisma } from '../../generated/prisma/client.js';
import type { CurrentSeasonParticipantRecord } from '../participants/season-participant-records.js';
import {
  createSeasonParticipantLifecycleEventRepository,
  type SeasonParticipantLifecycleEventRepository,
} from './season-participant-lifecycle-event.repository.js';
import {
  mapSeasonParticipantLifecycleMetadata,
  type SeasonParticipantLifecycleMetadata,
  type SeasonParticipantLifecycleSnapshot,
} from './season-participant-lifecycle-event.types.js';

function toLifecycleSnapshot(
  participant: Pick<
    CurrentSeasonParticipantRecord,
    'participantStatus' | 'participationIntent' | 'dormitoryId' | 'dormitorySelectionState'
  >,
): SeasonParticipantLifecycleSnapshot {
  return {
    participantStatus: participant.participantStatus,
    participationIntent: participant.participationIntent,
    dormitoryId: participant.dormitoryId,
    dormitorySelectionState: participant.dormitorySelectionState,
  };
}

function buildTransitionMetadata(input: {
  transitionOwner:
    'backfill.current-season-participants' | 'registration.finalize' | 'deregistration.command';
  previous: SeasonParticipantLifecycleSnapshot;
  next: SeasonParticipantLifecycleSnapshot;
  canceledPendingMatchRequests?: number;
  chatThreadsMarkedReadOnly?: number;
}): SeasonParticipantLifecycleMetadata {
  return mapSeasonParticipantLifecycleMetadata({
    transitionOwner: input.transitionOwner,
    previousStatus: input.previous.participantStatus,
    nextStatus: input.next.participantStatus,
    previousIntent: input.previous.participationIntent,
    nextIntent: input.next.participationIntent,
    previousDormitoryId: input.previous.dormitoryId,
    nextDormitoryId: input.next.dormitoryId,
    selectionState: input.next.dormitorySelectionState,
    canceledPendingMatchRequests: input.canceledPendingMatchRequests,
    chatThreadsMarkedReadOnly: input.chatThreadsMarkedReadOnly,
  });
}

export function buildSeasonParticipantLifecycleMetadataForTest(
  input: Record<string, unknown>,
): SeasonParticipantLifecycleMetadata {
  return mapSeasonParticipantLifecycleMetadata(input);
}

export function createSeasonParticipantLifecycleEventWriter(
  repository: SeasonParticipantLifecycleEventRepository = createSeasonParticipantLifecycleEventRepository(),
) {
  async function recordJoinedMany(
    tx: Prisma.TransactionClient,
    input: {
      participants: Array<
        Pick<
          CurrentSeasonParticipantRecord,
          | 'id'
          | 'seasonId'
          | 'userId'
          | 'joinedAt'
          | 'participantStatus'
          | 'participationIntent'
          | 'dormitoryId'
          | 'dormitorySelectionState'
        >
      >;
      occurredAt: Date;
    },
  ) {
    await repository.createMany(
      tx,
      input.participants.map((participant) => ({
        participantId: participant.id,
        seasonId: participant.seasonId,
        userId: participant.userId,
        eventType: 'JOINED',
        actorUserId: null,
        actorType: 'SYSTEM',
        reason: 'SEASON_PARTICIPANT_BACKFILLED',
        occurredAt: participant.joinedAt ?? input.occurredAt,
        metadata: mapSeasonParticipantLifecycleMetadata({
          transitionOwner: 'backfill.current-season-participants',
          nextStatus: participant.participantStatus,
          nextIntent: participant.participationIntent,
          nextDormitoryId: participant.dormitoryId,
          selectionState: participant.dormitorySelectionState,
        }),
      })),
    );
  }

  async function recordActivated(
    tx: Prisma.TransactionClient,
    input: {
      previousParticipant: CurrentSeasonParticipantRecord;
      participant: CurrentSeasonParticipantRecord;
      actorUserId: string;
      occurredAt: Date;
    },
  ) {
    await repository.create(tx, {
      participantId: input.participant.id,
      seasonId: input.participant.seasonId,
      userId: input.participant.userId,
      eventType: 'ACTIVATED',
      actorUserId: input.actorUserId,
      actorType: 'USER',
      reason: 'SEASON_REGISTRATION_FINALIZED',
      occurredAt: input.occurredAt,
      metadata: buildTransitionMetadata({
        transitionOwner: 'registration.finalize',
        previous: toLifecycleSnapshot(input.previousParticipant),
        next: toLifecycleSnapshot(input.participant),
      }),
    });
  }

  async function recordWithdrawn(
    tx: Prisma.TransactionClient,
    input: {
      participant: CurrentSeasonParticipantRecord;
      actorUserId: string;
      occurredAt: Date;
      canceledPendingMatchRequests?: number;
      chatThreadsMarkedReadOnly?: number;
    },
  ) {
    await repository.create(tx, {
      participantId: input.participant.id,
      seasonId: input.participant.seasonId,
      userId: input.participant.userId,
      eventType: 'WITHDRAWN',
      actorUserId: input.actorUserId,
      actorType: 'USER',
      reason: 'USER_DEREGISTERED',
      occurredAt: input.occurredAt,
      metadata: buildTransitionMetadata({
        transitionOwner: 'deregistration.command',
        previous: toLifecycleSnapshot(input.participant),
        next: {
          participantStatus: 'WITHDRAWN',
          participationIntent: 'DECLINED',
          dormitoryId: input.participant.dormitoryId,
          dormitorySelectionState: input.participant.dormitorySelectionState,
        },
        canceledPendingMatchRequests: input.canceledPendingMatchRequests,
        chatThreadsMarkedReadOnly: input.chatThreadsMarkedReadOnly,
      }),
    });
  }

  return { recordJoinedMany, recordActivated, recordWithdrawn };
}

export type SeasonParticipantLifecycleEventWriter = ReturnType<
  typeof createSeasonParticipantLifecycleEventWriter
>;
