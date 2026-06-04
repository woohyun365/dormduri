import { seasonParticipantsErrors } from '../errors/season-participants.errors.js';
import type { CurrentSeasonParticipantRecord } from '../participants/season-participant-records.js';
import { isParticipantRegistered } from '../season-participant-policy.js';

export function assertParticipantAllowsDormitorySelection(
  participant: CurrentSeasonParticipantRecord,
) {
  if (
    isParticipantRegistered(participant) ||
    participant.participationIntent === 'DECLINED' ||
    participant.participantStatus === 'WITHDRAWN' ||
    Boolean(participant.withdrawnAt || participant.declinedAt) ||
    Boolean(participant.hiddenByAdminAt || participant.deactivatedAt)
  ) {
    throw seasonParticipantsErrors.dormitorySelectionInvalid();
  }
}

export function hasParticipantDormitorySelection(participant: CurrentSeasonParticipantRecord) {
  return Boolean(
    participant.dormitoryId !== null &&
    (participant.dormitorySelectionState === 'SELECTED' ||
      participant.dormitorySelectionState === 'ASSIGNED'),
  );
}
