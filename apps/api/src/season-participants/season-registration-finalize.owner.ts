import type { SeasonRegistrationFinalizeResponse } from '@repo/shared/season-contract';
import type { Prisma } from '../generated/prisma/client.js';
import { toCompleteLifestyleColumnData } from '../profiles/profile-lifestyle.persistence.js';
import {
  assertRegistrationSeasonContext,
  getVerifiedUserForSeasonAction,
  type SeasonParticipantOwnerDeps,
} from './season-participant-owner-deps.js';
import type { SeasonParticipantContainerOwner } from './season-participant-container.owner.js';
import type { DormitorySelectionOwner } from './dormitory-selection.owner.js';
import {
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
  type CurrentSeasonParticipantRecord,
} from './season-participant-records.js';
import {
  assertParticipantAllowsRegistration,
  assertParticipantHasDormitorySelection,
  assertSeasonProfileCompleteForRegistration,
  buildCompletion,
} from './season-participation-capability.owner.js';
import { seasonParticipantsErrors } from './season-participants.errors.js';

export function createSeasonRegistrationFinalizeOwner(
  deps: SeasonParticipantOwnerDeps,
  containerOwner: SeasonParticipantContainerOwner,
  dormitorySelectionOwner: DormitorySelectionOwner,
) {
  async function finalizeSeasonRegistration(
    userId: string,
    now?: Date,
  ): Promise<SeasonRegistrationFinalizeResponse> {
    const referenceNow = now ?? (await deps.prisma.getDatabaseNow());
    const user = await getVerifiedUserForSeasonAction(deps, userId);
    await assertRegistrationSeasonContext(deps, user.campus, referenceNow);

    return deps.prisma.runSerializableTransaction(async (tx) => {
      const txUser = await getVerifiedUserForSeasonAction(deps, userId, tx);
      const txSeasonContext = await assertRegistrationSeasonContext(
        deps,
        txUser.campus,
        referenceNow,
        tx,
      );
      let participant = await containerOwner.ensureSeasonParticipantForSeason(
        txUser,
        txSeasonContext.season.id,
        referenceNow,
        tx,
      );
      if (!participant) {
        throw seasonParticipantsErrors.registrationNotAllowed();
      }
      assertParticipantAllowsRegistration(participant);
      assertSeasonProfileCompleteForRegistration(participant.profile);
      assertParticipantHasDormitorySelection(participant);

      const selectedDormitory = await dormitorySelectionOwner.validateDormitorySelection(
        tx,
        participant,
        txSeasonContext,
        participant.dormitoryId!,
        referenceNow,
      );

      const registeredAt = referenceNow;
      await tx.seasonParticipant.update({
        where: { id: participant.id },
        data: {
          participationIntent: 'REGISTERED',
          registeredAt,
          declinedAt: null,
          dormitorySelectionState: 'ASSIGNED',
          dormitoryId: selectedDormitory.id,
          participantStatus: 'ACTIVE',
          activatedAt: participant.activatedAt ?? registeredAt,
        },
      });

      await tx.seasonParticipantProfile.update({
        where: { participantId: participant.id },
        data: {
          nicknameSnapshot: txUser.displayIdentity!.nickname,
          nicknameNormalizedSnapshot: txUser.displayIdentity!.nicknameNormalized,
        },
      });

      const refreshed = await tx.seasonParticipant.findUnique({
        where: { id: participant.id },
        select: currentSeasonParticipantSelect,
      });
      if (!refreshed) {
        throw new Error('[SeasonRegistrationFinalizeOwner] finalized participant not found in tx');
      }
      participant = mapCurrentSeasonParticipantRecord(refreshed);
      assertSeasonProfileCompleteForRegistration(participant.profile);

      const history = await tx.seasonParticipantProfileHistory.create({
        data: toSeasonProfileHistoryCreateData(participant, registeredAt),
        select: {
          id: true,
          registeredAtSnapshot: true,
        },
      });

      return {
        seasonId: participant.seasonId,
        participantId: participant.id,
        participationIntent: 'REGISTERED',
        registeredAt: registeredAt.toISOString(),
        dormitorySelectionState: 'ASSIGNED',
        dormitoryId: selectedDormitory.id,
        profileState: 'REGISTRATION_FINALIZED',
        profileHistoryId: history.id,
        registeredAtSnapshot: (history.registeredAtSnapshot ?? registeredAt).toISOString(),
        completion: buildCompletion({
          hasCurrentSeason: true,
          campusOperated: true,
          activeSeasonPhase: true,
          profileComplete: true,
          dormitorySelectionReady: true,
          participantRegistrationLocked: false,
          accountOrParticipantInactive: false,
          hasSelectableDormitories: true,
          roomSelectionClosed: false,
        }),
      };
    });
  }

  return { finalizeSeasonRegistration };
}

export function toSeasonProfileHistoryCreateData(
  participant: CurrentSeasonParticipantRecord,
  registeredAt: Date,
): Prisma.SeasonParticipantProfileHistoryUncheckedCreateInput {
  if (!participant.profile) {
    throw seasonParticipantsErrors.registrationSeasonProfileIncomplete();
  }

  return {
    participantId: participant.id,
    seasonId: participant.seasonId,
    nicknameSnapshot: participant.profile.nicknameSnapshot,
    nicknameNormalizedSnapshot: participant.profile.nicknameNormalizedSnapshot,
    ...toCompleteLifestyleColumnData(participant.profile.lifestyle),
    intro: participant.profile.intro,
    collegeCode: participant.profile.collegeCode,
    grade: participant.profile.grade,
    mbti: participant.profile.mbti,
    birthYear: participant.profile.birthYear,
    registeredAtSnapshot: registeredAt,
    source: 'SEASON_REGISTRATION',
  };
}

export type SeasonRegistrationFinalizeOwner = ReturnType<
  typeof createSeasonRegistrationFinalizeOwner
>;
