import type { DormitorySelectionState } from '@repo/shared/dormitory-contract';
import type { ParticipationIntent } from '@repo/shared/user-contract';
import type { SeasonState } from '@repo/shared/season-contract';

export interface ParticipantPolicyRecord {
  participationIntent: ParticipationIntent;
  registeredAt: Date | null;
  declinedAt: Date | null;
  dormitoryId: string | null;
  dormitorySelectionState: DormitorySelectionState;
  participantStatus: 'NOT_STARTED' | 'DRAFT' | 'ACTIVE' | 'MATCHED' | 'WITHDRAWN' | 'EXPIRED';
  hiddenByAdminAt: Date | null;
  deactivatedAt: Date | null;
  profile?: { participantId: string } | null;
}

export function isParticipantRegistered(participant: ParticipantPolicyRecord | null | undefined) {
  return Boolean(
    participant &&
    participant.participationIntent === 'REGISTERED' &&
    participant.registeredAt &&
    !participant.declinedAt &&
    participant.participantStatus !== 'WITHDRAWN' &&
    participant.participantStatus !== 'EXPIRED',
  );
}

export function hasParticipantProfile(participant: ParticipantPolicyRecord | null | undefined) {
  return Boolean(participant?.profile);
}

export function requiresCurrentSeasonParticipantProfile(
  participant: ParticipantPolicyRecord | null | undefined,
  seasonState: SeasonState | null,
) {
  return (
    isParticipantRegistered(participant) &&
    !hasParticipantProfile(participant) &&
    (seasonState === 'SEASON_OPEN' ||
      seasonState === 'SEASON_MATCHING' ||
      seasonState === 'SEASON_POST_MATCH')
  );
}

export function isVisibleRegisteredParticipant(
  participant: ParticipantPolicyRecord | null | undefined,
) {
  return Boolean(
    isParticipantRegistered(participant) &&
    !participant?.hiddenByAdminAt &&
    !participant?.deactivatedAt,
  );
}
