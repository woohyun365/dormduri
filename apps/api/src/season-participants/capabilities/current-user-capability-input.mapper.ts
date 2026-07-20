import type { SeasonState } from '@repo/shared/season/runtime';
import type {
  CanonicalSelectionState,
  CurrentSeasonParticipantRecord,
} from '../application/season-participants.service.js';
import type { CurrentUserCapabilityInput } from './current-user-capabilities.policy.js';
import { hasOperatedAssignedDormitory, isParticipantRegistered } from '../policies/index.js';

type SelectionLike = Pick<CanonicalSelectionState, 'dormitoryId' | 'dormitorySelectionState'>;

export function buildCurrentUserCapabilityInput(input: {
  campusOperated: boolean;
  seasonState: SeasonState | null;
  participant: CurrentSeasonParticipantRecord | null;
  registrationSnapshotExists: boolean;
  participantMatched: boolean;
  seasonProfileComplete: boolean;
  selection: SelectionLike;
  operatedDormitoryIds: ReadonlySet<string>;
  currentDormitoryCanMatch: boolean;
  nicknameLockedBySeason: boolean;
  nicknameCooldownActive: boolean;
}): CurrentUserCapabilityInput {
  return {
    campusOperated: input.campusOperated,
    seasonState: input.seasonState,
    participantRegistered:
      isParticipantRegistered(input.participant) && input.registrationSnapshotExists,
    participantRegistrationLocked:
      input.participant?.participationIntent === 'DECLINED' ||
      input.participant?.participantStatus === 'WITHDRAWN',
    participantMatched: input.participantMatched,
    seasonProfileComplete: input.seasonProfileComplete,
    selectionState: input.selection.dormitorySelectionState,
    hasOperatedAssignedDormitory: hasOperatedAssignedDormitory(
      input.operatedDormitoryIds,
      input.selection.dormitorySelectionState,
      input.selection.dormitoryId,
    ),
    nicknameLockedBySeason: input.nicknameLockedBySeason,
    nicknameCooldownActive: input.nicknameCooldownActive,
    hasSelectableDormitories: input.operatedDormitoryIds.size > 0,
    currentDormitoryCanMatch: input.currentDormitoryCanMatch,
  };
}
