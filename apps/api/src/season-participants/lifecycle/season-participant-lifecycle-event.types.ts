import type {
  DormitorySelectionState,
  ParticipantStatus,
  SeasonParticipationIntent,
} from '../../generated/prisma/enums.js';

export const seasonParticipantLifecycleEventTypes = [
  'JOINED',
  'ACTIVATED',
  'WITHDRAWN',
  'EXPIRED',
  'DEACTIVATED',
  'HIDDEN',
  'UNHIDDEN',
  'MATCHED',
  'UNMATCHED',
] as const;

export type SeasonParticipantLifecycleEventType =
  (typeof seasonParticipantLifecycleEventTypes)[number];

export const seasonParticipantLifecycleActorTypes = ['USER', 'SYSTEM', 'ADMIN'] as const;

export type SeasonParticipantLifecycleActorType =
  (typeof seasonParticipantLifecycleActorTypes)[number];

export const seasonParticipantLifecycleReasons = [
  'SEASON_PARTICIPANT_BACKFILLED',
  'SEASON_REGISTRATION_FINALIZED',
  'USER_DEREGISTERED',
] as const;

export type SeasonParticipantLifecycleReason = (typeof seasonParticipantLifecycleReasons)[number];

export const seasonParticipantLifecycleMetadataKeys = [
  'transitionOwner',
  'previousStatus',
  'nextStatus',
  'previousIntent',
  'nextIntent',
  'previousDormitoryId',
  'nextDormitoryId',
  'selectionState',
  'canceledPendingMatchRequests',
  'chatThreadsMarkedReadOnly',
] as const;

export type SeasonParticipantLifecycleMetadataKey =
  (typeof seasonParticipantLifecycleMetadataKeys)[number];

export type SeasonParticipantLifecycleMetadataValue = string | number | boolean | null;

export type SeasonParticipantLifecycleMetadata = Partial<
  Record<SeasonParticipantLifecycleMetadataKey, SeasonParticipantLifecycleMetadataValue>
>;

export interface SeasonParticipantLifecycleEventInput {
  participantId: string;
  seasonId: string;
  userId: string;
  eventType: SeasonParticipantLifecycleEventType;
  actorUserId?: string | null;
  actorType: SeasonParticipantLifecycleActorType;
  reason: SeasonParticipantLifecycleReason;
  metadata?: SeasonParticipantLifecycleMetadata;
  occurredAt: Date;
}

export interface SeasonParticipantLifecycleSnapshot {
  participantStatus: ParticipantStatus;
  participationIntent: SeasonParticipationIntent;
  dormitoryId: string | null;
  dormitorySelectionState: DormitorySelectionState;
}

export function mapSeasonParticipantLifecycleMetadata(
  input: Record<string, unknown>,
): SeasonParticipantLifecycleMetadata {
  const metadata: SeasonParticipantLifecycleMetadata = {};

  for (const key of seasonParticipantLifecycleMetadataKeys) {
    const value = input[key];
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      metadata[key] = value;
    }
  }

  return metadata;
}
