import type { SelectableDormitory } from '@repo/shared/season-contract';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Campus, Gender } from '../../generated/prisma/enums.js';
import type { CurrentSeasonContext } from '../../seasons/season.types.js';
import { seasonParticipantsErrors } from '../errors/season-participants.errors.js';
import type {
  CurrentSeasonParticipantRecord,
  SeasonParticipantEnsureInput,
} from '../participants/season-participant-records.js';
import type { SeasonParticipantOwnerDeps } from '../season-participant-owner-deps.js';
import { hasParticipantDormitorySelection } from './dormitory-selection.policy.js';

export function createDormitorySelectionReadinessEvaluator(deps: SeasonParticipantOwnerDeps) {
  async function listSelectableDormitoriesForParticipant(
    participant: CurrentSeasonParticipantRecord,
    seasonContext: CurrentSeasonContext,
    now: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<SelectableDormitory[]> {
    return deps.dormitorySelectionCatalog.listSelectableDormitoriesForSeasonParticipant({
      seasonContext,
      campusCodeSnapshot: participant.campusCodeSnapshot,
      genderSnapshot: participant.genderSnapshot,
      now,
      queryClient: tx,
    });
  }

  async function listSelectableDormitoriesForSnapshot(
    campusCode: Campus,
    gender: Gender,
    seasonContext: CurrentSeasonContext,
    now: Date,
  ): Promise<SelectableDormitory[]> {
    return deps.dormitorySelectionCatalog.listSelectableDormitoriesForSeasonParticipant({
      seasonContext,
      campusCodeSnapshot: campusCode,
      genderSnapshot: gender,
      now,
    });
  }

  async function hasSelectableDormitoriesForCurrentParticipant(
    participant: CurrentSeasonParticipantRecord | null,
    seasonContext: CurrentSeasonContext | null,
    now: Date,
  ): Promise<boolean> {
    if (!participant || !seasonContext) {
      return false;
    }

    const items = await listSelectableDormitoriesForParticipant(participant, seasonContext, now);
    return items.length > 0;
  }

  async function hasSelectableDormitoriesForCurrentUser(
    user: SeasonParticipantEnsureInput,
    seasonContext: CurrentSeasonContext | null,
    now: Date,
  ): Promise<boolean> {
    if (!user.emailVerifiedAt || !seasonContext) {
      return false;
    }

    const items = await listSelectableDormitoriesForSnapshot(
      user.campus,
      user.gender,
      seasonContext,
      now,
    );
    return items.length > 0;
  }

  async function hasValidDormitorySelectionForCurrentParticipant(
    participant: CurrentSeasonParticipantRecord | null,
    seasonContext: CurrentSeasonContext | null,
    now: Date,
  ): Promise<boolean> {
    if (!participant || !seasonContext || !hasParticipantDormitorySelection(participant)) {
      return false;
    }

    const items = await listSelectableDormitoriesForParticipant(participant, seasonContext, now);
    return items.some((item) => item.id === participant.dormitoryId);
  }

  async function validateDormitorySelection(
    tx: Prisma.TransactionClient,
    participant: CurrentSeasonParticipantRecord,
    seasonContext: CurrentSeasonContext,
    dormitoryId: string,
    now: Date,
  ): Promise<SelectableDormitory> {
    const validation =
      await deps.dormitorySelectionCatalog.validateSelectableDormitoryForSeasonParticipant({
        seasonContext,
        campusCodeSnapshot: participant.campusCodeSnapshot,
        genderSnapshot: participant.genderSnapshot,
        dormitoryId,
        now,
        queryClient: tx,
      });

    if (!validation.valid) {
      throw seasonParticipantsErrors.dormitorySelectionInvalid();
    }

    return validation.item;
  }

  return {
    listSelectableDormitoriesForParticipant,
    listSelectableDormitoriesForSnapshot,
    hasSelectableDormitoriesForCurrentParticipant,
    hasSelectableDormitoriesForCurrentUser,
    hasValidDormitorySelectionForCurrentParticipant,
    validateDormitorySelection,
  };
}

export type DormitorySelectionReadinessEvaluator = ReturnType<
  typeof createDormitorySelectionReadinessEvaluator
>;
