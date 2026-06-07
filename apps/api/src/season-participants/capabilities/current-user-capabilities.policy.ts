import type { SeasonState } from '@repo/shared/season/runtime';
import type { CurrentUserResponse } from '@repo/shared/user-contract';
import type { DisplayIdentityEditUnavailableReason } from '@repo/shared/display-identity-contract';
import type { AcademicIdentityEditUnavailableReason } from '@repo/shared/academic-identity-contract';
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
  const academicIdentityEditUnavailableReasons = buildAcademicIdentityEditUnavailableReasons(input);
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
    canEnterRoommateSearch:
      input.campusOperated &&
      (input.seasonState === 'SEASON_OPEN' ||
        input.seasonState === 'SEASON_MATCHING' ||
        input.seasonState === 'SEASON_POST_MATCH'),
    canCreateOrUpdateSeasonProfileDraft,
    canSelectDormitory,
    canFinalizeSeasonRegistration,
    canEditDisplayIdentity: displayIdentityEditUnavailableReasons.length === 0,
    displayIdentityEditUnavailableReasons,
    canEditAcademicIdentity: academicIdentityEditUnavailableReasons.length === 0,
    academicIdentityEditUnavailableReasons,
    canBookmark:
      canActOnPublicTargets &&
      (input.seasonState === 'SEASON_OPEN' || input.seasonState === 'SEASON_MATCHING'),
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

function buildAcademicIdentityEditUnavailableReasons(input: {
  participantRegistered: boolean;
}): AcademicIdentityEditUnavailableReason[] {
  const reasons: AcademicIdentityEditUnavailableReason[] = [];
  if (input.participantRegistered) {
    reasons.push('CURRENT_SEASON_REGISTRATION_LOCK');
  }
  return reasons;
}
