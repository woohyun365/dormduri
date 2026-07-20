import type { SeasonState } from '@repo/shared/season/runtime';
import { isSeasonProfileComplete, lifestyleSchema } from '@repo/shared/lifestyle';
import type { CurrentSeasonContext } from '../../seasons/ports/season-context.port.js';
import type {
  CanonicalSelectionState,
  CurrentSeasonParticipantRecord,
} from '../application/season-participants.service.js';
import {
  hasOperatedAssignedDormitory,
  hasParticipantProfile,
  isParticipantRegistered,
  isVisibleRegisteredParticipant,
} from '../policies/index.js';
import type {
  PublicTargetPolicyTargetInput,
  PublicTargetPolicyViewerInput,
} from './public-target-policy.types.js';

type SelectionLike = Pick<CanonicalSelectionState, 'dormitoryId' | 'dormitorySelectionState'>;

export function toOperatedDormitoryIdSet(
  seasonContext: Pick<CurrentSeasonContext, 'operatedDormitories'> | null | undefined,
): ReadonlySet<string> {
  return new Set(seasonContext?.operatedDormitories.map((item) => item.dormitoryId) ?? []);
}

export function buildPublicTargetPolicyViewerInput(input: {
  campusOperated: boolean;
  seasonState: SeasonState | null;
  participant: CurrentSeasonParticipantRecord | null;
  registrationSnapshotExists: boolean;
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
    registered: isParticipantRegistered(input.participant) && input.registrationSnapshotExists,
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
