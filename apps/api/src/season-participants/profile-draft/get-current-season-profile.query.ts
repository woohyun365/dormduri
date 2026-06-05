import type { SeasonProfileDraftResponse } from '@repo/shared/season-contract';
import { getVerifiedUserForSeasonAction } from '../application/season-action-user.query.js';
import { assertReadableSeasonContext } from '../application/season-context.query.js';
import type { SeasonParticipantUseCaseDeps } from '../application/season-participant-use-case.deps.js';
import type { SeasonParticipantContainerOwner } from '../participants/season-participant-container.command.js';
import {
  buildEmptySeasonProfileDraftResponse,
  buildSeasonProfileDraftResponse,
} from './season-profile-draft.mapper.js';

export function createGetCurrentSeasonProfileQuery(
  deps: SeasonParticipantUseCaseDeps,
  containerOwner: SeasonParticipantContainerOwner,
) {
  async function getCurrentSeasonProfile(
    userId: string,
    now?: Date,
  ): Promise<SeasonProfileDraftResponse> {
    const referenceNow = now ?? (await deps.prisma.getDatabaseNow());
    const user = await getVerifiedUserForSeasonAction(deps, userId);
    const seasonContext = await assertReadableSeasonContext(deps, user.campus, referenceNow);
    const participant = await containerOwner.findCurrentSeasonParticipant(
      user.id,
      seasonContext.season.id,
    );

    return participant
      ? buildSeasonProfileDraftResponse(participant, seasonContext, referenceNow)
      : buildEmptySeasonProfileDraftResponse(seasonContext);
  }

  return { getCurrentSeasonProfile };
}

export type GetCurrentSeasonProfileQuery = ReturnType<typeof createGetCurrentSeasonProfileQuery>;
