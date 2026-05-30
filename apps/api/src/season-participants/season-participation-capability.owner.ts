import type {
  SeasonParticipationCompletionState,
  SeasonProfileDraftResponse,
  SeasonProfileState,
  SeasonRegistrationBlockReason,
  SelectableDormitory,
} from '@repo/shared/season-contract';
import { isSeasonProfileComplete, type LifestyleData } from '@repo/shared/lifestyle';
import type { CurrentSeasonContext } from '../seasons/season.types.js';
import { lifestyleFieldNames } from '../common/lifestyle/lifestyle.persistence.js';
import { isParticipantRegistered } from './season-participant-policy.js';
import { canCurrentDormitoryMatch } from './season-participant-selection.js';
import { seasonParticipantsErrors } from './season-participants.errors.js';
import {
  toAdditionalProfileFromRecord,
  type CurrentSeasonParticipantProfileRecord,
  type CurrentSeasonParticipantRecord,
} from './season-participant-records.js';

export function validateSeasonProfileCompleteness(
  profile: CurrentSeasonParticipantProfileRecord | null | undefined,
): { complete: boolean } {
  if (!profile) {
    return { complete: false };
  }

  return {
    complete:
      isSeasonProfileComplete(profile.lifestyle) && profile.grade !== null && profile.mbti !== null,
  };
}

export function assertSeasonProfileCompleteForRegistration(
  profile: CurrentSeasonParticipantProfileRecord | null | undefined,
) {
  if (!validateSeasonProfileCompleteness(profile).complete) {
    throw seasonParticipantsErrors.registrationSeasonProfileIncomplete();
  }
}

export function resolveSeasonProfileState(
  participant: CurrentSeasonParticipantRecord | null | undefined,
): SeasonProfileState {
  if (!participant?.profile) {
    return 'NONE';
  }
  if (isParticipantRegistered(participant)) {
    return 'REGISTRATION_FINALIZED';
  }
  return validateSeasonProfileCompleteness(participant.profile).complete ? 'COMPLETE' : 'DRAFT';
}

export function buildCompletion(input: {
  hasCurrentSeason: boolean;
  campusOperated: boolean;
  activeSeasonPhase: boolean;
  profileComplete: boolean;
  dormitorySelectionReady: boolean;
  participantRegistrationLocked: boolean;
  accountOrParticipantInactive: boolean;
  hasSelectableDormitories?: boolean;
  roomSelectionClosed?: boolean;
}): SeasonParticipationCompletionState {
  const registrationUnavailableReasons: SeasonRegistrationBlockReason[] = [];

  if (!input.hasCurrentSeason) {
    registrationUnavailableReasons.push('NO_CURRENT_SEASON');
  }
  if (!input.campusOperated) {
    registrationUnavailableReasons.push('UNSUPPORTED_CAMPUS');
  }
  if (input.hasCurrentSeason && !input.activeSeasonPhase) {
    registrationUnavailableReasons.push('SEASON_NOT_OPEN');
  }
  if (!input.profileComplete) {
    registrationUnavailableReasons.push('PROFILE_INCOMPLETE');
  }
  if (input.activeSeasonPhase && !input.dormitorySelectionReady) {
    registrationUnavailableReasons.push('DORMITORY_SELECTION_REQUIRED');
  }
  if (input.activeSeasonPhase && input.hasSelectableDormitories === false) {
    registrationUnavailableReasons.push('NO_SELECTABLE_DORMITORY');
  }
  if (input.activeSeasonPhase && input.roomSelectionClosed) {
    registrationUnavailableReasons.push('DORMITORY_SELECTION_CLOSED');
  }
  if (input.participantRegistrationLocked) {
    registrationUnavailableReasons.push('WITHDRAWN_OR_DECLINED_LOCK');
  }
  if (input.accountOrParticipantInactive) {
    registrationUnavailableReasons.push('ACCOUNT_OR_PARTICIPANT_INACTIVE');
  }

  return {
    profileCompletionRequired: input.activeSeasonPhase && !input.profileComplete,
    dormitorySelectionRequired: input.activeSeasonPhase && !input.dormitorySelectionReady,
    registrationUnavailable: registrationUnavailableReasons.length > 0,
    registrationUnavailableReasons,
  };
}

export function buildEmptySeasonProfileDraftResponse(
  seasonContext: CurrentSeasonContext,
): SeasonProfileDraftResponse {
  const activeSeasonPhase = isSeasonProfileWritablePhase(seasonContext.state);

  return {
    participantId: null,
    seasonId: seasonContext.season.id,
    state: 'NONE',
    lifestyle: emptyLifestyle(),
    intro: '',
    additional: toAdditionalProfileFromRecord(null),
    completion: buildCompletion({
      hasCurrentSeason: true,
      campusOperated: true,
      activeSeasonPhase,
      profileComplete: false,
      dormitorySelectionReady: false,
      participantRegistrationLocked: false,
      accountOrParticipantInactive: false,
    }),
    draftWritable: activeSeasonPhase,
  };
}

export function buildCompletionForSeasonActionSnapshot(input: {
  seasonContext: CurrentSeasonContext;
  profileComplete: boolean;
  dormitorySelectionReady: boolean;
  hasSelectableDormitories: boolean;
}): SeasonParticipationCompletionState {
  const activeSeasonPhase = isSeasonProfileWritablePhase(input.seasonContext.state);

  return buildCompletion({
    hasCurrentSeason: true,
    campusOperated: true,
    activeSeasonPhase,
    profileComplete: input.profileComplete,
    dormitorySelectionReady: input.dormitorySelectionReady,
    participantRegistrationLocked: false,
    accountOrParticipantInactive: false,
    hasSelectableDormitories: input.hasSelectableDormitories,
    roomSelectionClosed:
      input.seasonContext.state === 'SEASON_MATCHING' && !input.hasSelectableDormitories,
  });
}

export function buildSeasonProfileDraftResponse(
  participant: CurrentSeasonParticipantRecord,
  seasonContext: CurrentSeasonContext,
  now: Date,
): SeasonProfileDraftResponse {
  const profileState = resolveSeasonProfileState(participant);
  const profileComplete = validateSeasonProfileCompleteness(participant.profile).complete;
  const activeSeasonPhase = isSeasonProfileWritablePhase(seasonContext.state);

  return {
    participantId: participant.id,
    seasonId: participant.seasonId,
    state: profileState,
    lifestyle: participant.profile?.lifestyle ?? emptyLifestyle(),
    intro: participant.profile?.intro ?? '',
    additional: toAdditionalProfileFromRecord(participant.profile),
    completion: buildCompletion({
      hasCurrentSeason: true,
      campusOperated: true,
      activeSeasonPhase,
      profileComplete,
      dormitorySelectionReady: hasParticipantDormitorySelection(participant),
      participantRegistrationLocked: isParticipantRegistrationLocked(participant),
      accountOrParticipantInactive: isParticipantInactive(participant),
      roomSelectionClosed:
        participant.dormitoryId !== null &&
        seasonContext.state === 'SEASON_MATCHING' &&
        !canCurrentDormitoryMatch(seasonContext, participant.dormitoryId, now),
    }),
    draftWritable:
      activeSeasonPhase &&
      !isParticipantRegistered(participant) &&
      !isParticipantLockedOrInactive(participant),
  };
}

export function buildCompletionForParticipant(
  participant: CurrentSeasonParticipantRecord,
  seasonContext: CurrentSeasonContext,
  now: Date,
  selectableDormitories?: SelectableDormitory[],
): SeasonParticipationCompletionState {
  const profileComplete = validateSeasonProfileCompleteness(participant.profile).complete;
  const activeSeasonPhase = isSeasonProfileWritablePhase(seasonContext.state);
  const dormitorySelectionReady =
    hasParticipantDormitorySelection(participant) &&
    (selectableDormitories === undefined ||
      selectableDormitories.some((item) => item.id === participant.dormitoryId));

  return buildCompletion({
    hasCurrentSeason: true,
    campusOperated: true,
    activeSeasonPhase,
    profileComplete,
    dormitorySelectionReady,
    participantRegistrationLocked: isParticipantRegistrationLocked(participant),
    accountOrParticipantInactive: isParticipantInactive(participant),
    hasSelectableDormitories: (selectableDormitories?.length ?? 1) > 0,
    roomSelectionClosed:
      seasonContext.state === 'SEASON_MATCHING' &&
      selectableDormitories !== undefined &&
      selectableDormitories.length === 0,
  });
}

export function assertParticipantAllowsProfileDraftWrite(
  participant: CurrentSeasonParticipantRecord,
) {
  if (isParticipantRegistered(participant) || isParticipantLockedOrInactive(participant)) {
    throw seasonParticipantsErrors.seasonProfileDraftNotAllowed();
  }
}

export function assertParticipantAllowsDormitorySelection(
  participant: CurrentSeasonParticipantRecord,
) {
  if (isParticipantRegistered(participant) || isParticipantLockedOrInactive(participant)) {
    throw seasonParticipantsErrors.dormitorySelectionInvalid();
  }
}

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

export function hasParticipantDormitorySelection(participant: CurrentSeasonParticipantRecord) {
  return Boolean(
    participant.dormitoryId !== null &&
    (participant.dormitorySelectionState === 'SELECTED' ||
      participant.dormitorySelectionState === 'ASSIGNED'),
  );
}

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

function isSeasonProfileWritablePhase(state: CurrentSeasonContext['state']) {
  return state === 'SEASON_OPEN' || state === 'SEASON_MATCHING';
}

function emptyLifestyle(): LifestyleData {
  return Object.fromEntries(lifestyleFieldNames.map((field) => [field, null])) as LifestyleData;
}
