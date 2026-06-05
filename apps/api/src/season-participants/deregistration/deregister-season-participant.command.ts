import {
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
  type CurrentSeasonParticipantRecord,
} from '../participants/season-participant-records.js';
import { getVerifiedUserForSeasonAction } from '../application/season-action-user.query.js';
import type { SeasonParticipantUseCaseDeps } from '../application/season-participant-use-case.deps.js';
import { seasonParticipantsErrors } from '../errors/season-participants.errors.js';
import {
  assertDeregistrationSeasonContext,
  assertNoLiveActiveMatch,
  assertParticipantAllowsDeregistration,
} from './season-deregistration.policy.js';
import type { SeasonParticipantLifecycleEventWriter } from '../lifecycle/season-participant-lifecycle-event.writer.js';

export function createDeregisterSeasonParticipantCommand(
  deps: SeasonParticipantUseCaseDeps,
  lifecycleEventWriter: SeasonParticipantLifecycleEventWriter,
) {
  async function deregisterCurrentSeasonParticipation(
    userId: string,
    now?: Date,
  ): Promise<CurrentSeasonParticipantRecord> {
    const referenceNow = now ?? (await deps.prisma.getDatabaseNow());
    const user = await getVerifiedUserForSeasonAction(deps, userId);
    const seasonContext = await deps.seasonsService.getCurrentSeasonContext(
      user.campus,
      referenceNow,
    );
    assertDeregistrationSeasonContext(seasonContext);

    const participant = await deps.prisma.seasonParticipant.findUnique({
      where: {
        seasonId_userId: {
          seasonId: seasonContext.season.id,
          userId,
        },
      },
      select: currentSeasonParticipantSelect,
    });

    if (!participant) {
      throw seasonParticipantsErrors.deregistrationNotAllowed();
    }

    const mappedParticipant = mapCurrentSeasonParticipantRecord(participant);
    assertParticipantAllowsDeregistration(mappedParticipant);

    const liveActiveMatch = await deps.prisma.activeMatch.findFirst({
      where: {
        seasonId: mappedParticipant.seasonId,
        endedAt: null,
        OR: [{ participantAId: mappedParticipant.id }, { participantBId: mappedParticipant.id }],
      },
      select: { id: true },
    });
    assertNoLiveActiveMatch(liveActiveMatch);

    await deps.prisma.runSerializableTransaction(async (tx) => {
      const txLiveActiveMatch = await tx.activeMatch.findFirst({
        where: {
          seasonId: mappedParticipant.seasonId,
          endedAt: null,
          OR: [{ participantAId: mappedParticipant.id }, { participantBId: mappedParticipant.id }],
        },
        select: { id: true },
      });
      assertNoLiveActiveMatch(txLiveActiveMatch);

      await tx.seasonParticipant.update({
        where: { id: mappedParticipant.id },
        data: {
          participationIntent: 'DECLINED',
          declinedAt: mappedParticipant.declinedAt ?? referenceNow,
          participantStatus: 'WITHDRAWN',
          withdrawnAt: mappedParticipant.withdrawnAt ?? referenceNow,
        },
      });

      const canceledPendingMatchRequests = await tx.matchRequest.updateMany({
        where: {
          seasonId: mappedParticipant.seasonId,
          status: 'PENDING',
          OR: [
            { requesterParticipantId: mappedParticipant.id },
            { receiverParticipantId: mappedParticipant.id },
          ],
        },
        data: {
          status: 'CANCELLED_BY_SYSTEM',
          terminalReason: 'WITHDRAWN_PARTICIPANT',
          terminalAt: referenceNow,
        },
      });

      const chatWithdrawalResult =
        await deps.chatThreadWithdrawal.markOpenDirectThreadsReadOnlyForWithdrawnParticipant(tx, {
          seasonId: mappedParticipant.seasonId,
          participantId: mappedParticipant.id,
          now: referenceNow,
        });

      await lifecycleEventWriter.recordWithdrawn(tx, {
        participant: mappedParticipant,
        actorUserId: user.id,
        occurredAt: referenceNow,
        canceledPendingMatchRequests: canceledPendingMatchRequests.count,
        chatThreadsMarkedReadOnly: chatWithdrawalResult.updatedThreadIds.length,
      });
    });

    const refreshed = await deps.prisma.seasonParticipant.findUnique({
      where: { id: mappedParticipant.id },
      select: currentSeasonParticipantSelect,
    });

    if (!refreshed) {
      throw new Error('[DeregisterSeasonParticipantCommand] participant not found after update');
    }

    return mapCurrentSeasonParticipantRecord(refreshed);
  }

  return { deregisterCurrentSeasonParticipation };
}

export type DeregisterSeasonParticipantCommand = ReturnType<
  typeof createDeregisterSeasonParticipantCommand
>;
