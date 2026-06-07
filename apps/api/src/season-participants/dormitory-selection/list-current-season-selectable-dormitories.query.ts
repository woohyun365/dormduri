import type { SelectableDormitoriesResponse } from '@repo/shared/season/participation';
import type { SeasonParticipantContainerOwner } from '../participants/season-participant-container.command.js';
import { getVerifiedUserForSeasonAction } from '../application/season-action-user.query.js';
import { assertWritableSeasonContext } from '../application/season-context.query.js';
import type { SeasonParticipantUseCaseDeps } from '../application/season-participant-use-case.deps.js';
import { buildSelectableDormitoriesResponse } from './dormitory-selection.mapper.js';
import type { DormitorySelectionReadinessEvaluator } from './dormitory-selection-readiness.evaluator.js';

export function createListCurrentSeasonSelectableDormitoriesQuery(
  deps: SeasonParticipantUseCaseDeps,
  containerOwner: SeasonParticipantContainerOwner,
  readiness: DormitorySelectionReadinessEvaluator,
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
      ? await readiness.listSelectableDormitoriesForParticipant(
          participant,
          seasonContext,
          referenceNow,
        )
      : await readiness.listSelectableDormitoriesForSnapshot(
          user.campus,
          user.gender,
          seasonContext,
          referenceNow,
        );

    return buildSelectableDormitoriesResponse({
      seasonContext,
      participant,
      items,
      now: referenceNow,
    });
  }

  return { listSelectableDormitoriesForCurrentSeason };
}

export type ListCurrentSeasonSelectableDormitoriesQuery = ReturnType<
  typeof createListCurrentSeasonSelectableDormitoriesQuery
>;
