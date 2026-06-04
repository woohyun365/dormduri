import { seasonParticipantsErrors } from '../errors/season-participants.errors.js';
import type { CurrentSeasonParticipantRecord } from '../participants/season-participant-records.js';
import { isParticipantRegistered } from '../policies/index.js';
import { hasParticipantDormitorySelection } from '../dormitory-selection/dormitory-selection.policy.js';
import {
  isParticipantLockedOrInactive,
  isParticipantRegistrationLocked,
} from '../capabilities/season-participation-capability.policy.js';

export function assertParticipantAllowsRegistration(participant: CurrentSeasonParticipantRecord) {
  if (
    isParticipantRegistered(participant) ||
    isParticipantLockedOrInactive(participant) ||
    isParticipantRegistrationLocked(participant)
  ) {
    throw seasonParticipantsErrors.registrationNotAllowed();
  }
}

export function assertParticipantHasDormitorySelection(
  participant: CurrentSeasonParticipantRecord,
) {
  if (!hasParticipantDormitorySelection(participant)) {
    throw seasonParticipantsErrors.registrationNotAllowed();
  }
}
