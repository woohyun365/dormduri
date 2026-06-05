import type {
  SeasonProfileDraftRequest,
  SeasonProfileDraftResponse,
} from '@repo/shared/season-contract';
import { getVerifiedUserForSeasonAction } from '../application/season-action-user.query.js';
import { assertWritableSeasonContext } from '../application/season-context.query.js';
import type { SeasonParticipantUseCaseDeps } from '../application/season-participant-use-case.deps.js';
import {
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
} from '../participants/season-participant-records.js';
import type { SeasonParticipantContainerOwner } from '../participants/season-participant-container.command.js';
import { assertParticipantAllowsProfileDraftWrite } from './season-profile-completeness.policy.js';
import {
  buildSeasonProfileDraftResponse,
  toSeasonProfileDraftColumnData,
} from './season-profile-draft.mapper.js';

export function createUpsertSeasonProfileDraftCommand(
  deps: SeasonParticipantUseCaseDeps,
  containerOwner: SeasonParticipantContainerOwner,
) {
  async function createOrUpdateSeasonProfileDraft(
    userId: string,
    input: SeasonProfileDraftRequest,
    now?: Date,
  ): Promise<SeasonProfileDraftResponse> {
    const referenceNow = now ?? (await deps.prisma.getDatabaseNow());
    const user = await getVerifiedUserForSeasonAction(deps, userId);
    const seasonContext = await assertWritableSeasonContext(deps, user.campus, referenceNow);

    const participantId = await deps.prisma.runSerializableTransaction(async (tx) => {
      const txUser = await getVerifiedUserForSeasonAction(deps, userId, tx);
      const participant = await containerOwner.ensureSeasonParticipantForSeason(
        txUser,
        seasonContext.season.id,
        referenceNow,
        tx,
      );
      if (!participant) {
        throw new Error(
          '[UpsertSeasonProfileDraftCommand] participant ensure failed in writable season',
        );
      }
      assertParticipantAllowsProfileDraftWrite(participant);

      if (!txUser.displayIdentity) {
        throw new Error('[UpsertSeasonProfileDraftCommand] user display identity row is required');
      }
      const draftData = toSeasonProfileDraftColumnData(input, txUser.displayIdentity);
      await tx.seasonParticipantProfile.upsert({
        where: { participantId: participant.id },
        create: {
          participantId: participant.id,
          ...draftData,
        },
        update: draftData,
      });
      if (participant.participantStatus === 'NOT_STARTED') {
        await tx.seasonParticipant.update({
          where: { id: participant.id },
          data: { participantStatus: 'DRAFT' },
        });
      }

      return participant.id;
    });

    const refreshed = await deps.prisma.seasonParticipant.findUnique({
      where: { id: participantId },
      select: currentSeasonParticipantSelect,
    });
    if (!refreshed) {
      throw new Error(
        '[UpsertSeasonProfileDraftCommand] season profile draft participant not found',
      );
    }

    return buildSeasonProfileDraftResponse(
      mapCurrentSeasonParticipantRecord(refreshed),
      seasonContext,
      referenceNow,
    );
  }

  return { createOrUpdateSeasonProfileDraft };
}

export type UpsertSeasonProfileDraftCommand = ReturnType<
  typeof createUpsertSeasonProfileDraftCommand
>;
