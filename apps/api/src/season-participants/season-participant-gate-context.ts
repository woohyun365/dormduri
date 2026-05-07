import type { SeasonState } from '@repo/shared/season-contract';
import type { CurrentSeasonContext } from '../seasons/season.types.js';
import type {
  CanonicalSelectionState,
  CurrentSeasonParticipantRecord,
} from './season-participants.service.js';
import {
  hasOperatedAssignedDormitory,
  hasParticipantProfile,
  isParticipantRegistered,
  isVisibleRegisteredParticipant,
  type CurrentUserCapabilityInput,
  type PublicExposureTargetInput,
  type PublicExposureViewerInput,
} from './season-participant-policy.js';

type SelectionLike = Pick<CanonicalSelectionState, 'dormitoryId' | 'dormitorySelectionState'>;

export function toOperatedDormitoryIdSet(
  seasonContext: Pick<CurrentSeasonContext, 'operatedDormitories'> | null | undefined,
): ReadonlySet<string> {
  return new Set(seasonContext?.operatedDormitories.map((item) => item.dormitoryId) ?? []);
}

export function buildCurrentUserCapabilityInput(input: {
  campusOperated: boolean;
  seasonState: SeasonState | null;
  participant: CurrentSeasonParticipantRecord | null;
  participantMatched: boolean;
  selection: SelectionLike;
  operatedDormitoryIds: ReadonlySet<string>;
  currentDormitoryCanMatch: boolean;
  nicknameLockedBySeason: boolean;
  nicknameCooldownActive: boolean;
}): CurrentUserCapabilityInput {
  return {
    campusOperated: input.campusOperated,
    seasonState: input.seasonState,
    participantRegistered: isParticipantRegistered(input.participant),
    participantMatched: input.participantMatched,
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

export function buildPublicExposureViewerInput(input: {
  campusOperated: boolean;
  seasonState: SeasonState | null;
  participant: CurrentSeasonParticipantRecord | null;
  matched: boolean;
  matchedPartnerParticipantId: string | null;
  selection: SelectionLike;
  operatedDormitoryIds: ReadonlySet<string>;
  currentDormitoryCanMatch: boolean;
}): PublicExposureViewerInput {
  return {
    campusOperated: input.campusOperated,
    seasonState: input.seasonState,
    registered: isParticipantRegistered(input.participant),
    matched: input.matched,
    matchedPartnerParticipantId: input.matchedPartnerParticipantId,
    selectionState: input.selection.dormitorySelectionState,
    dormitoryId: input.selection.dormitoryId,
    hasOperatedAssignedDormitory: hasOperatedAssignedDormitory(
      input.operatedDormitoryIds,
      input.selection.dormitorySelectionState,
      input.selection.dormitoryId,
    ),
    currentDormitoryCanMatch: input.currentDormitoryCanMatch,
  };
}

export function buildPublicExposureTargetInput(input: {
  seasonState: SeasonState | null;
  operatedDormitoryIds: ReadonlySet<string>;
  participant: CurrentSeasonParticipantRecord | null;
  matched: boolean;
  selection: SelectionLike;
}): PublicExposureTargetInput {
  const hasSeasonProfile = hasParticipantProfile(input.participant);
  const currentSeasonExposureVisible =
    isVisibleRegisteredParticipant(input.participant) && hasSeasonProfile;

  return {
    participantId: input.participant?.id ?? null,
    visible:
      input.seasonState === null || input.seasonState === 'OFF_SEASON'
        ? true
        : currentSeasonExposureVisible,
    registered: isParticipantRegistered(input.participant),
    matched: input.matched,
    selectionState: input.selection.dormitorySelectionState,
    dormitoryId: input.selection.dormitoryId,
    hasOperatedAssignedDormitory: hasOperatedAssignedDormitory(
      input.operatedDormitoryIds,
      input.selection.dormitorySelectionState,
      input.selection.dormitoryId,
    ),
    hasSeasonProfile,
  };
}
