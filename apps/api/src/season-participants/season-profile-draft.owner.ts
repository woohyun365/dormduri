import type {
  SeasonProfileDraftRequest,
  SeasonProfileDraftResponse,
} from '@repo/shared/season-contract';
import type { Prisma } from '../generated/prisma/client.js';
import { toLifestyleColumnData } from './lifestyle/lifestyle-persistence.mapper.js';
import {
  assertReadableSeasonContext,
  assertWritableSeasonContext,
  getVerifiedUserForSeasonAction,
  type SeasonParticipantOwnerDeps,
  type VerifiedSeasonActionUser,
} from './season-participant-owner-deps.js';
import {
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
  type CurrentSeasonParticipantProfileRecord,
} from './season-participant-records.js';
import type { SeasonParticipantContainerOwner } from './season-participant-container.owner.js';
import {
  assertParticipantAllowsProfileDraftWrite,
  assertSeasonProfileCompleteForRegistration,
  buildEmptySeasonProfileDraftResponse,
  buildSeasonProfileDraftResponse,
  validateSeasonProfileCompleteness,
} from './season-participation-capability.owner.js';

export function createSeasonProfileDraftOwner(
  deps: SeasonParticipantOwnerDeps,
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
        throw new Error('[SeasonProfileDraftOwner] participant ensure failed in writable season');
      }
      assertParticipantAllowsProfileDraftWrite(participant);

      if (!txUser.displayIdentity) {
        throw new Error('[SeasonProfileDraftOwner] user display identity row is required');
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
      throw new Error('[SeasonProfileDraftOwner] season profile draft participant not found');
    }

    return buildSeasonProfileDraftResponse(
      mapCurrentSeasonParticipantRecord(refreshed),
      seasonContext,
      referenceNow,
    );
  }

  return {
    getCurrentSeasonProfile,
    createOrUpdateSeasonProfileDraft,
    validateSeasonProfileCompleteness,
    assertSeasonProfileCompleteForRegistration,
  };
}

export function toSeasonProfileDraftColumnData(
  input: SeasonProfileDraftRequest,
  displayIdentity: NonNullable<VerifiedSeasonActionUser['displayIdentity']>,
): Omit<Prisma.SeasonParticipantProfileUncheckedCreateInput, 'participantId'> {
  const additional = input.additional;
  return {
    nicknameSnapshot: displayIdentity.nickname,
    nicknameNormalizedSnapshot: displayIdentity.nicknameNormalized,
    ...toLifestyleColumnData(input.lifestyle),
    intro: (input.intro ?? '').trim(),
    grade: additional.grade,
    mbti: additional.mbti,
  };
}

export type SeasonProfileDraftOwner = ReturnType<typeof createSeasonProfileDraftOwner>;
export type SeasonProfileCompletenessProfile =
  | CurrentSeasonParticipantProfileRecord
  | null
  | undefined;
