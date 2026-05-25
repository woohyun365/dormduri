import type { SeasonState } from '@repo/shared/season-contract';
import type {
  CurrentUserResponse,
  DisplayIdentityEditUnavailableReason,
} from '@repo/shared/user-contract';
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
  const displayIdentityEditUnavailableReasons = buildDisplayIdentityEditUnavailableReasons(input);
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
    canEditDisplayIdentity: displayIdentityEditUnavailableReasons.length === 0,
    displayIdentityEditUnavailableReasons,
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

function buildDisplayIdentityEditUnavailableReasons(input: {
  nicknameLockedBySeason: boolean;
  nicknameCooldownActive: boolean;
}): DisplayIdentityEditUnavailableReason[] {
  const reasons: DisplayIdentityEditUnavailableReason[] = [];
  if (input.nicknameLockedBySeason) {
    reasons.push('CURRENT_SEASON_REGISTRATION_LOCK');
  }
  if (input.nicknameCooldownActive) {
    reasons.push('NICKNAME_COOLDOWN_ACTIVE');
  }
  return reasons;
}
