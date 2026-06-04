import { isSeasonProfileComplete } from '@repo/shared/lifestyle';
import { seasonParticipantsErrors } from '../errors/season-participants.errors.js';
import { isParticipantRegistered } from '../season-participant-policy.js';
import type {
  CurrentSeasonParticipantProfileRecord,
  CurrentSeasonParticipantRecord,
} from '../participants/season-participant-records.js';

export type SeasonProfileCompletenessProfile =
  | CurrentSeasonParticipantProfileRecord
  | null
  | undefined;

export function validateSeasonProfileCompleteness(profile: SeasonProfileCompletenessProfile): {
  complete: boolean;
} {
  if (!profile) {
    return { complete: false };
  }

  return {
    complete:
      isSeasonProfileComplete(profile.lifestyle) && profile.grade !== null && profile.mbti !== null,
  };
}

export function assertSeasonProfileCompleteForRegistration(
  profile: SeasonProfileCompletenessProfile,
) {
  if (!validateSeasonProfileCompleteness(profile).complete) {
    throw seasonParticipantsErrors.registrationSeasonProfileIncomplete();
  }
}

export function assertParticipantAllowsProfileDraftWrite(
  participant: CurrentSeasonParticipantRecord,
) {
  if (
    isParticipantRegistered(participant) ||
    participant.participationIntent === 'DECLINED' ||
    participant.participantStatus === 'WITHDRAWN' ||
    Boolean(participant.withdrawnAt || participant.declinedAt) ||
    Boolean(participant.hiddenByAdminAt || participant.deactivatedAt)
  ) {
    throw seasonParticipantsErrors.seasonProfileDraftNotAllowed();
  }
}
