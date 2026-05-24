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

export function buildCurrentUserCapabilities(
  input: CurrentUserCapabilityInput,
): CurrentUserResponse['capabilities'] {
  const activeSeasonPhase =
    input.seasonState === 'SEASON_OPEN' || input.seasonState === 'SEASON_MATCHING';
  const canCreateOrUpdateSeasonProfileDraft =
    input.campusOperated &&
    activeSeasonPhase &&
    !input.participantRegistered &&
    !input.participantRegistrationLocked;
  const canSelectDormitory =
    input.campusOperated &&
    activeSeasonPhase &&
    !input.participantRegistered &&
    !input.participantRegistrationLocked &&
    input.hasSelectableDormitories;
  const canFinalizeSeasonRegistration =
    canSelectDormitory && input.seasonProfileComplete && input.selectionState === 'SELECTED';
  const canActOnPublicTargets =
    input.campusOperated &&
    input.participantRegistered &&
    !input.participantMatched &&
    input.seasonProfileComplete &&
    input.hasOperatedAssignedDormitory;

  return {
    canBrowseProfiles:
      input.campusOperated &&
      (input.seasonState === 'SEASON_OPEN' ||
        input.seasonState === 'SEASON_MATCHING' ||
        input.seasonState === 'SEASON_POST_MATCH'),
    canCreateOrUpdateSeasonProfileDraft,
    canSelectDormitory,
    canFinalizeSeasonRegistration,
    canEditDisplayIdentity: !input.nicknameLockedBySeason && !input.nicknameCooldownActive,
    canBookmark:
      input.campusOperated &&
      input.participantRegistered &&
      input.seasonProfileComplete &&
      input.hasOperatedAssignedDormitory &&
      (input.seasonState === 'SEASON_OPEN' ||
        input.seasonState === 'SEASON_MATCHING' ||
        input.seasonState === 'SEASON_POST_MATCH'),
    canRequestMatch:
      canActOnPublicTargets &&
      input.seasonState === 'SEASON_MATCHING' &&
      input.currentDormitoryCanMatch,
    canStartChat:
      canActOnPublicTargets &&
      (input.seasonState === 'SEASON_OPEN' ||
        (input.seasonState === 'SEASON_MATCHING' && input.currentDormitoryCanMatch)),
  };
}
