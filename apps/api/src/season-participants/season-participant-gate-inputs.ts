import type { SeasonState } from '@repo/shared/season-contract';
import { isSeasonProfileComplete, lifestyleSchema } from '@repo/shared/lifestyle';
import type { CurrentSeasonContext } from '../seasons/season.types.js';
import type {
  CanonicalSelectionState,
  CurrentSeasonParticipantRecord,
} from './application/season-participants.service.js';
import type { CurrentUserCapabilityInput } from './capabilities/index.js';
import {
  hasOperatedAssignedDormitory,
  hasParticipantProfile,
  isParticipantRegistered,
  isVisibleRegisteredParticipant,
} from './policies/index.js';
import type {
  PublicTargetPolicyTargetInput,
  PublicTargetPolicyViewerInput,
} from './public-target-policy/index.js';

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
    participantRegistered: isParticipantRegistered(input.participant),
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

export function buildPublicTargetPolicyViewerInput(input: {
  campusOperated: boolean;
  seasonState: SeasonState | null;
  participant: CurrentSeasonParticipantRecord | null;
  matched: boolean;
  seasonProfileComplete: boolean;
  matchedPartnerParticipantId: string | null;
  selection: SelectionLike;
  operatedDormitoryIds: ReadonlySet<string>;
  currentDormitoryCanMatch: boolean;
}): PublicTargetPolicyViewerInput {
  return {
    campusOperated: input.campusOperated,
    seasonState: input.seasonState,
    registered: isParticipantRegistered(input.participant),
    matched: input.matched,
    seasonProfileComplete: input.seasonProfileComplete,
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

export function buildPublicTargetPolicyTargetInput(input: {
  operatedDormitoryIds: ReadonlySet<string>;
  participant: CurrentSeasonParticipantRecord | null;
  matched: boolean;
  selection: SelectionLike;
  registrationSnapshotExists: boolean;
  deletedOrDeidentified?: boolean;
}): PublicTargetPolicyTargetInput {
  const hasSeasonProfile = hasParticipantProfile(input.participant);
  const parsedSeasonProfileLifestyle = input.participant?.profile
    ? lifestyleSchema.safeParse(input.participant.profile.lifestyle)
    : null;
  const seasonProfileComplete =
    parsedSeasonProfileLifestyle?.success === true &&
    isSeasonProfileComplete(parsedSeasonProfileLifestyle.data);
  const currentSeasonExposureVisible = isVisibleRegisteredParticipant(input.participant);

  return {
    participantId: input.participant?.id ?? null,
    visible: currentSeasonExposureVisible,
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
    seasonProfileComplete,
    registrationSnapshotExists: input.registrationSnapshotExists,
    deletedOrDeidentified: input.deletedOrDeidentified ?? false,
  };
}
