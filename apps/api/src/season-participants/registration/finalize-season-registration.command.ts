import type { SeasonRegistrationFinalizeResponse } from '@repo/shared/season-contract';
import {
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
} from '../participants/season-participant-records.js';
import type { SeasonParticipantContainerOwner } from '../participants/season-participant-container.command.js';
import {
  assertRegistrationSeasonContext,
  getVerifiedUserForSeasonAction,
  type SeasonParticipantOwnerDeps,
} from '../season-participant-owner-deps.js';
import { seasonParticipantsErrors } from '../errors/season-participants.errors.js';
import { buildCompletion } from '../season-participation-capability.owner.js';
import { assertSeasonProfileCompleteForRegistration } from '../profile-draft/season-profile-completeness.policy.js';
import { toSeasonProfileHistoryCreateData } from './season-registration-history.mapper.js';
import type { SeasonRegistrationReadinessEvaluator } from './season-registration-readiness.evaluator.js';
import type { SeasonParticipantLifecycleEventWriter } from '../lifecycle/season-participant-lifecycle-event.writer.js';

export function createFinalizeSeasonRegistrationCommand(
  deps: SeasonParticipantOwnerDeps,
  containerOwner: SeasonParticipantContainerOwner,
  readiness: SeasonRegistrationReadinessEvaluator,
  lifecycleEventWriter: SeasonParticipantLifecycleEventWriter,
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
      const previousParticipant = participant;

      const registrationReady = await readiness.assertReadyForRegistration({
        tx,
        user: txUser,
        participant,
        seasonContext: txSeasonContext,
        now: referenceNow,
      });
      const { selectedDormitory, displayIdentity, academicIdentity } = registrationReady;

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
          nicknameSnapshot: displayIdentity.nickname,
          nicknameNormalizedSnapshot: displayIdentity.nicknameNormalized,
          collegeCode: academicIdentity.collegeCode,
          birthYear: academicIdentity.birthYear,
        },
      });

      const refreshed = await tx.seasonParticipant.findUnique({
        where: { id: participant.id },
        select: currentSeasonParticipantSelect,
      });
      if (!refreshed) {
        throw new Error(
          '[FinalizeSeasonRegistrationCommand] finalized participant not found in tx',
        );
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

      await lifecycleEventWriter.recordActivated(tx, {
        previousParticipant,
        participant,
        actorUserId: txUser.id,
        occurredAt: registeredAt,
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

export type FinalizeSeasonRegistrationCommand = ReturnType<
  typeof createFinalizeSeasonRegistrationCommand
>;
