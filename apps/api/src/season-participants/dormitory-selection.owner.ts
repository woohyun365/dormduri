import type {
  DormitorySelectionDraftResponse,
  SelectableDormitoriesResponse,
  SelectableDormitory,
  SelectedDormitorySubmitRequest,
} from '@repo/shared/season-contract';
import type { Prisma } from '../generated/prisma/client.js';
import type { Campus, Gender } from '../generated/prisma/enums.js';
import type { CurrentSeasonContext } from '../seasons/season.types.js';
import {
  assertWritableSeasonContext,
  getVerifiedUserForSeasonAction,
  type SeasonParticipantOwnerDeps,
} from './season-participant-owner-deps.js';
import type { SeasonParticipantContainerOwner } from './participants/season-participant-container.command.js';
import {
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
  type CurrentSeasonParticipantRecord,
  type SeasonParticipantEnsureInput,
} from './participants/season-participant-records.js';
import {
  assertParticipantAllowsDormitorySelection,
  buildCompletionForParticipant,
  buildCompletionForSeasonActionSnapshot,
  hasParticipantDormitorySelection,
} from './season-participation-capability.owner.js';
import { resolveSeasonProfileState } from './profile-draft/season-profile-draft.mapper.js';
import { seasonParticipantsErrors } from './errors/season-participants.errors.js';

export function createDormitorySelectionOwner(
  deps: SeasonParticipantOwnerDeps,
  containerOwner: SeasonParticipantContainerOwner,
) {
  async function listSelectableDormitoriesForCurrentSeason(
    userId: string,
    now?: Date,
  ): Promise<SelectableDormitoriesResponse> {
    const referenceNow = now ?? (await deps.prisma.getDatabaseNow());
    const user = await getVerifiedUserForSeasonAction(deps, userId);
    const seasonContext = await assertWritableSeasonContext(deps, user.campus, referenceNow);
    const participant = await containerOwner.findCurrentSeasonParticipant(
      user.id,
      seasonContext.season.id,
    );
    const items = participant
      ? await listSelectableDormitoriesForParticipant(participant, seasonContext, referenceNow)
      : await listSelectableDormitoriesForSnapshot(
          user.campus,
          user.gender,
          seasonContext,
          referenceNow,
        );

    return {
      seasonId: seasonContext.season.id,
      seasonState: seasonContext.state,
      profileState: resolveSeasonProfileState(participant),
      completion: participant
        ? buildCompletionForParticipant(participant, seasonContext, referenceNow, items)
        : buildCompletionForSeasonActionSnapshot({
            seasonContext,
            profileComplete: false,
            dormitorySelectionReady: false,
            hasSelectableDormitories: items.length > 0,
          }),
      items,
    };
  }

  async function createOrUpdateDormitorySelection(
    userId: string,
    input: SelectedDormitorySubmitRequest,
    now?: Date,
  ): Promise<DormitorySelectionDraftResponse> {
    const referenceNow = now ?? (await deps.prisma.getDatabaseNow());
    const user = await getVerifiedUserForSeasonAction(deps, userId);
    const seasonContext = await assertWritableSeasonContext(deps, user.campus, referenceNow);

    return deps.prisma.runSerializableTransaction(async (tx) => {
      const txUser = await getVerifiedUserForSeasonAction(deps, userId, tx);
      const participant = await containerOwner.ensureSeasonParticipantForSeason(
        txUser,
        seasonContext.season.id,
        referenceNow,
        tx,
      );
      if (!participant) {
        throw seasonParticipantsErrors.registrationNotAllowed();
      }
      assertParticipantAllowsDormitorySelection(participant);

      const selectedDormitory = await validateDormitorySelection(
        tx,
        participant,
        seasonContext,
        input.dormitoryId,
        referenceNow,
      );

      const updated = await tx.seasonParticipant.update({
        where: { id: participant.id },
        data: {
          dormitorySelectionState: 'SELECTED',
          dormitoryId: selectedDormitory.id,
          participantStatus:
            participant.participantStatus === 'NOT_STARTED'
              ? 'DRAFT'
              : participant.participantStatus,
        },
        select: currentSeasonParticipantSelect,
      });
      const mapped = mapCurrentSeasonParticipantRecord(updated);

      return {
        seasonId: mapped.seasonId,
        participantId: mapped.id,
        dormitorySelectionState: 'SELECTED',
        dormitoryId: selectedDormitory.id,
        profileState: resolveSeasonProfileState(mapped),
        completion: buildCompletionForParticipant(mapped, seasonContext, referenceNow, [
          selectedDormitory,
        ]),
      };
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
    listSelectableDormitoriesForCurrentSeason,
    createOrUpdateDormitorySelection,
    hasSelectableDormitoriesForCurrentParticipant,
    hasSelectableDormitoriesForCurrentUser,
    hasValidDormitorySelectionForCurrentParticipant,
    validateDormitorySelection,
  };
}

export type DormitorySelectionOwner = ReturnType<typeof createDormitorySelectionOwner>;
