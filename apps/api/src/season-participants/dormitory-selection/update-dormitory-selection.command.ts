import type {
  DormitorySelectionDraftResponse,
  SelectedDormitorySubmitRequest,
} from '@repo/shared/season-contract';
import {
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
} from '../participants/season-participant-records.js';
import type { SeasonParticipantContainerOwner } from '../participants/season-participant-container.command.js';
import { getVerifiedUserForSeasonAction } from '../application/season-action-user.query.js';
import { assertWritableSeasonContext } from '../application/season-context.query.js';
import type { SeasonParticipantUseCaseDeps } from '../application/season-participant-use-case.deps.js';
import { seasonParticipantsErrors } from '../errors/season-participants.errors.js';
import { buildDormitorySelectionDraftResponse } from './dormitory-selection.mapper.js';
import { assertParticipantAllowsDormitorySelection } from './dormitory-selection.policy.js';
import type { DormitorySelectionReadinessEvaluator } from './dormitory-selection-readiness.evaluator.js';

export function createUpdateDormitorySelectionCommand(
  deps: SeasonParticipantUseCaseDeps,
  containerOwner: SeasonParticipantContainerOwner,
  readiness: DormitorySelectionReadinessEvaluator,
) {
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

      const selectedDormitory = await readiness.validateDormitorySelection(
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

      return buildDormitorySelectionDraftResponse({
        participant: mapped,
        selectedDormitory,
        seasonContext,
        now: referenceNow,
      });
    });
  }

  return { createOrUpdateDormitorySelection };
}

export type UpdateDormitorySelectionCommand = ReturnType<
  typeof createUpdateDormitorySelectionCommand
>;
