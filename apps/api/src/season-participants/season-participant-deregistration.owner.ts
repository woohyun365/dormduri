import { isParticipantRegistered } from './season-participant-policy.js';
import {
  currentSeasonParticipantSelect,
  mapCurrentSeasonParticipantRecord,
  type CurrentSeasonParticipantRecord,
} from './participants/season-participant-records.js';
import {
  getVerifiedUserForSeasonAction,
  type SeasonParticipantOwnerDeps,
} from './season-participant-owner-deps.js';
import { seasonParticipantsErrors } from './errors/season-participants.errors.js';

export function createSeasonParticipantDeregistrationOwner(deps: SeasonParticipantOwnerDeps) {
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

    if (
      !seasonContext ||
      (seasonContext.state !== 'SEASON_OPEN' && seasonContext.state !== 'SEASON_MATCHING')
    ) {
      throw seasonParticipantsErrors.deregistrationNotAllowed();
    }

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
    if (!isParticipantRegistered(mappedParticipant)) {
      throw seasonParticipantsErrors.deregistrationNotAllowed();
    }

    const liveActiveMatch = await deps.prisma.activeMatch.findFirst({
      where: {
        seasonId: mappedParticipant.seasonId,
        endedAt: null,
        OR: [{ participantAId: mappedParticipant.id }, { participantBId: mappedParticipant.id }],
      },
      select: { id: true },
    });

    if (liveActiveMatch) {
      throw seasonParticipantsErrors.deregistrationNotAllowed();
    }

    await deps.prisma.runSerializableTransaction(async (tx) => {
      await tx.seasonParticipant.update({
        where: { id: mappedParticipant.id },
        data: {
          participationIntent: 'DECLINED',
          declinedAt: mappedParticipant.declinedAt ?? referenceNow,
          participantStatus: 'WITHDRAWN',
          withdrawnAt: mappedParticipant.withdrawnAt ?? referenceNow,
        },
      });

      await tx.matchRequest.updateMany({
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

      await deps.chatThreadWithdrawal.markOpenDirectThreadsReadOnlyForWithdrawnParticipant(tx, {
        seasonId: mappedParticipant.seasonId,
        participantId: mappedParticipant.id,
        now: referenceNow,
      });
    });

    const refreshed = await deps.prisma.seasonParticipant.findUnique({
      where: { id: mappedParticipant.id },
      select: currentSeasonParticipantSelect,
    });

    if (!refreshed) {
      throw new Error('[SeasonParticipantDeregistrationOwner] participant not found after update');
    }

    return mapCurrentSeasonParticipantRecord(refreshed);
  }

  return { deregisterCurrentSeasonParticipation };
}

export type SeasonParticipantDeregistrationOwner = ReturnType<
  typeof createSeasonParticipantDeregistrationOwner
>;
