import type { SeasonState } from '@repo/shared/season-contract';
import type { DormitorySelectionState } from '@repo/shared/dormitory-contract';
import type { CurrentUserResponse } from '@repo/shared/user-contract';
import { buildCurrentUserCapabilities } from '../season-participants/season-participant-policy.js';

export function canBrowseProfiles(_input: {
  campusOperated: boolean;
  seasonState: SeasonState | null;
  selectionState: DormitorySelectionState;
}): boolean {
  return true;
}

export function buildUserCapabilities(input: {
  campusOperated: boolean;
  seasonState: SeasonState | null;
  participantRegistered: boolean;
  participantMatched: boolean;
  selectionState: DormitorySelectionState;
  hasOperatedAssignedDormitory: boolean;
  nicknameLockedBySeason: boolean;
  nicknameCooldownActive: boolean;
  hasSelectableDormitories: boolean;
  currentDormitoryCanMatch: boolean;
}): CurrentUserResponse['capabilities'] {
  return buildCurrentUserCapabilities(input);
}
