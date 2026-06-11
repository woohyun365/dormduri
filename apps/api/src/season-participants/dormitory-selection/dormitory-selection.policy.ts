import { seasonParticipantsErrors } from '../errors/season-participants.errors.js';
import type { CurrentSeasonParticipantRecord } from '../participants/season-participant-records.js';
import { isParticipantRegistered } from '../policies/index.js';
import { isParticipantLockedOrInactive } from '../capabilities/season-participation-capability.policy.js';

export function assertParticipantAllowsDormitorySelection(
  participant: CurrentSeasonParticipantRecord,
) {
  if (isParticipantRegistered(participant) || isParticipantLockedOrInactive(participant)) {
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
