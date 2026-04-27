import type { SeasonState } from '@repo/shared/season-contract';
import type { DormitorySelectionState } from '@repo/shared/dormitory-contract';
import type { CurrentUserResponse } from '@repo/shared/user-contract';

export function canBrowseProfiles(input: {
  campusOperated: boolean;
  seasonState: SeasonState | null;
  selectionState: DormitorySelectionState;
}): boolean {
  if (!input.campusOperated) {
    return true;
  }

  if (input.seasonState === 'OFF_SEASON') {
    return true;
  }

  return input.selectionState === 'ASSIGNED';
}

export function buildUserCapabilities(input: {
  campusOperated: boolean;
  seasonState: SeasonState | null;
  selectionState: DormitorySelectionState;
  nicknameLockedBySeason: boolean;
  nicknameCooldownActive: boolean;
  hasSelectableDormitories: boolean;
  currentDormitoryCanMatch: boolean;
}): CurrentUserResponse['capabilities'] {
  const isAssigned = input.selectionState === 'ASSIGNED';
  const seasonState = input.seasonState;

  return {
    canSelectDormitory:
      input.campusOperated &&
      input.hasSelectableDormitories &&
      input.selectionState !== 'ASSIGNED' &&
      (seasonState === 'SEASON_PREPARATION' || seasonState === 'SEASON_MATCHING'),
    canEditLifestyle:
      !input.campusOperated ||
      seasonState === null ||
      seasonState === 'OFF_SEASON' ||
      seasonState === 'SEASON_PREPARATION' ||
      seasonState === 'SEASON_POST_MATCH' ||
      (seasonState === 'SEASON_MATCHING' && input.selectionState !== 'ASSIGNED'),
    canEditNickname: !input.nicknameLockedBySeason && !input.nicknameCooldownActive,
    canEditProfileText: true,
    canBookmark:
      input.campusOperated &&
      isAssigned &&
      (seasonState === 'SEASON_PREPARATION' ||
        seasonState === 'SEASON_MATCHING' ||
        seasonState === 'SEASON_POST_MATCH'),
    canRequestMatch:
      input.campusOperated &&
      isAssigned &&
      seasonState === 'SEASON_MATCHING' &&
      input.currentDormitoryCanMatch,
  };
}
