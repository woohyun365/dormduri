import type { CurrentSeasonContext } from '../../seasons/season.types.js';
import type { CurrentSeasonParticipantRecord } from '../participants/season-participant-records.js';

export function isParticipantRegistrationLocked(participant: CurrentSeasonParticipantRecord) {
  return Boolean(
    participant.participationIntent === 'DECLINED' ||
    participant.participantStatus === 'WITHDRAWN' ||
    participant.withdrawnAt ||
    participant.declinedAt,
  );
}

export function isParticipantInactive(participant: CurrentSeasonParticipantRecord) {
  return Boolean(participant.hiddenByAdminAt || participant.deactivatedAt);
}

export function isParticipantLockedOrInactive(participant: CurrentSeasonParticipantRecord) {
  return isParticipantRegistrationLocked(participant) || isParticipantInactive(participant);
}

export function isSeasonProfileWritablePhase(state: CurrentSeasonContext['state']) {
  return state === 'SEASON_OPEN' || state === 'SEASON_MATCHING';
}
