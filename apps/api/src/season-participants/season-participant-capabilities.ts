import type { ProfileSource } from '@repo/shared/profile-contract';
import type { SeasonState } from '@repo/shared/season-contract';
import type { CurrentUserResponse } from '@repo/shared/user-contract';
import type { DormitorySelectionState } from '@repo/shared/dormitory-contract';

export interface CurrentUserCapabilityInput {
  campusOperated: boolean;
  seasonState: SeasonState | null;
  participantRegistered: boolean;
  participantRegistrationLocked?: boolean;
  participantMatched: boolean;
  seasonProfileComplete: boolean;
  selectionState: DormitorySelectionState;
  hasOperatedAssignedDormitory: boolean;
  nicknameLockedBySeason: boolean;
  nicknameCooldownActive: boolean;
  hasSelectableDormitories: boolean;
  currentDormitoryCanMatch: boolean;
}

export function resolveCurrentUserProfileSource(input: {
  campusOperated: boolean;
  seasonState: SeasonState | null;
  participantRegistered: boolean;
  participantProfileExists: boolean;
}): ProfileSource {
  if (!input.campusOperated) {
    return 'USER_PROFILE';
  }

  if (
    input.participantRegistered &&
    input.participantProfileExists &&
    (input.seasonState === 'SEASON_OPEN' ||
      input.seasonState === 'SEASON_MATCHING' ||
      input.seasonState === 'SEASON_POST_MATCH')
  ) {
    return 'SEASON_PARTICIPANT_PROFILE';
  }

  return 'USER_PROFILE';
}

export function resolveCurrentUserProfileEditability(
  input: CurrentUserCapabilityInput,
): CurrentUserResponse['capabilities']['profileEdit'] {
  const nicknameEditable = !input.nicknameLockedBySeason && !input.nicknameCooldownActive;

  if (!input.campusOperated || input.seasonState === null || input.seasonState === 'OFF_SEASON') {
    return {
      intro: true,
      messageToRoommate: true,
      additional: true,
      lifestyle: true,
      nickname: nicknameEditable,
    };
  }

  if (input.seasonState === 'SEASON_POST_MATCH') {
    return {
      intro: false,
      messageToRoommate: false,
      additional: false,
      lifestyle: false,
      nickname: false,
    };
  }

  if (!input.participantRegistered) {
    return {
      intro: true,
      messageToRoommate: true,
      additional: true,
      lifestyle: true,
      nickname: nicknameEditable,
    };
  }

  if (input.seasonState === 'SEASON_OPEN') {
    return {
      intro: true,
      messageToRoommate: true,
      additional: true,
      lifestyle: true,
      nickname: false,
    };
  }

  return {
    intro: false,
    messageToRoommate: true,
    additional: true,
    lifestyle: false,
    nickname: false,
  };
}

export function buildCurrentUserCapabilities(
  input: CurrentUserCapabilityInput,
): CurrentUserResponse['capabilities'] {
  const profileEdit = resolveCurrentUserProfileEditability(input);
  const activeSeasonPhase =
    input.seasonState === 'SEASON_OPEN' || input.seasonState === 'SEASON_MATCHING';
  const canBrowseProfiles = true;

  return {
    canBrowseProfiles,
    canRegisterParticipation:
      input.campusOperated &&
      activeSeasonPhase &&
      !input.participantRegistered &&
      !input.participantRegistrationLocked &&
      input.seasonProfileComplete,
    canSelectDormitory:
      input.campusOperated &&
      input.participantRegistered &&
      input.hasSelectableDormitories &&
      input.selectionState !== 'ASSIGNED' &&
      activeSeasonPhase,
    canEditLifestyle: profileEdit.lifestyle,
    canEditNickname: profileEdit.nickname,
    canEditProfileText:
      profileEdit.intro || profileEdit.messageToRoommate || profileEdit.additional,
    canBookmark:
      input.campusOperated &&
      input.participantRegistered &&
      input.hasSelectableDormitories &&
      input.hasOperatedAssignedDormitory &&
      (input.seasonState === 'SEASON_OPEN' ||
        input.seasonState === 'SEASON_MATCHING' ||
        input.seasonState === 'SEASON_POST_MATCH'),
    canRequestMatch:
      input.campusOperated &&
      input.participantRegistered &&
      !input.participantMatched &&
      input.seasonProfileComplete &&
      input.hasOperatedAssignedDormitory &&
      input.seasonState === 'SEASON_MATCHING' &&
      input.currentDormitoryCanMatch,
    canStartChat:
      input.campusOperated &&
      input.participantRegistered &&
      !input.participantMatched &&
      input.seasonProfileComplete &&
      input.hasOperatedAssignedDormitory &&
      (input.seasonState === 'SEASON_OPEN' ||
        (input.seasonState === 'SEASON_MATCHING' && input.currentDormitoryCanMatch)),
    profileEdit,
  };
}
