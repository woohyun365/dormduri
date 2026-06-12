import { Injectable } from '@nestjs/common';
import { isSeasonProfileComplete } from '@repo/shared/lifestyle';
import { Prisma } from '../../../generated/prisma/client.js';
import { lifestyleColumnSelect } from '../../../season-participants/lifestyle/lifestyle-persistence.mapper.js';
import { formatKstDate } from '../../../platform/time/kst-date.js';
import { parseLifestyleOrNull } from '../../../profiles/contracts/public-profile.presenter.js';
import { matchesErrors } from '../../errors/matches.errors.js';
import { matchRequestSummarySelect, type MatchRequestRecord } from './match-request.select.js';
import { resolveMatchRequestExpiresAt } from '../policies/match-request-expiration.policy.js';
import type { PreparedMatchRequestCreation } from '../eligibility/match-request-creation.evaluator.js';
import {
  canPersistPreparedMatchRequest,
  isMatchRequestCreationParticipantReady,
} from '../policies/match-request-creation.policy.js';
import {
  canActorResolveTerminalMatchRequest,
  type TerminalMatchRequestReason,
  type TerminalMatchRequestStatus,
} from '../policies/match-request-terminal.policy.js';
import {
  acquirePairLock,
  acquireParticipantLocks,
  assertDirectionCooldown,
  assertDirectionLimit,
  assertNoLiveActiveMatchForParticipants,
  assertNoLivePendingPair,
  assertPendingRequestLimit,
  expireDuePendingRequests,
  lockRequestRow,
} from './match-request-locks.js';

const matchRequestCreationParticipantSelect = {
  id: true,
  registeredAt: true,
  dormitoryId: true,
  dormitorySelectionState: true,
  participationIntent: true,
  participantStatus: true,
  declinedAt: true,
  withdrawnAt: true,
  hiddenByAdminAt: true,
  deactivatedAt: true,
  user: {
    select: {
      deletedAt: true,
    },
  },
  profile: {
    select: lifestyleColumnSelect,
  },
} as const satisfies Prisma.SeasonParticipantSelect;

type MatchRequestCreationParticipant = Prisma.SeasonParticipantGetPayload<{
  select: typeof matchRequestCreationParticipantSelect;
}>;

@Injectable()
export class MatchRequestRepository {
  async createPendingMatchRequest(
    tx: Prisma.TransactionClient,
    input: PreparedMatchRequestCreation,
    now: Date,
  ) {
    await this.assertCanCreatePendingMatchRequest(tx, input, now);

    try {
      return await tx.matchRequest.create({
        data: {
          seasonId: input.seasonId,
          pairKey: input.pairIdentity.pairKey,
          pairMinParticipantId: input.pairIdentity.pairMinParticipantId,
          pairMaxParticipantId: input.pairIdentity.pairMaxParticipantId,
          requesterParticipantId: input.requesterParticipantId,
          receiverParticipantId: input.receiverParticipantId,
          note: input.note,
          status: 'PENDING',
          expiresAt: resolveMatchRequestExpiresAt(now, input.requesterRoomSelectionDate),
        },
        select: matchRequestSummarySelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw matchesErrors.requestAlreadyPending();
      }
      throw error;
    }
  }

  async loadTerminableMatchRequest(
    tx: Prisma.TransactionClient,
    requestId: string,
    actingParticipantId: string,
    status: TerminalMatchRequestStatus,
    now: Date,
  ): Promise<MatchRequestRecord> {
    await lockRequestRow(tx, requestId);

    const request = await tx.matchRequest.findUnique({
      where: { id: requestId },
      select: matchRequestSummarySelect,
    });
    if (!request) {
      throw matchesErrors.requestNotFound();
    }
    if (request.status !== 'PENDING') {
      throw matchesErrors.requestNotPending();
    }
    if (request.expiresAt.getTime() <= now.getTime()) {
      await tx.matchRequest.update({
        where: { id: request.id },
        data: {
          status: 'EXPIRED',
          terminalReason: 'EXPIRED',
          terminalAt: now,
        },
      });
      throw matchesErrors.requestExpired();
    }
    if (
      !canActorResolveTerminalMatchRequest({
        status,
        requesterParticipantId: request.requesterParticipantId,
        receiverParticipantId: request.receiverParticipantId,
        actingParticipantId,
      })
    ) {
      throw getRequestTerminalNotAllowedError(status);
    }

    return request;
  }

  async executeTerminalMatchRequestUpdate(
    tx: Prisma.TransactionClient,
    request: MatchRequestRecord,
    status: TerminalMatchRequestStatus,
    terminalReason: TerminalMatchRequestReason,
    now: Date,
  ): Promise<MatchRequestRecord> {
    return await tx.matchRequest.update({
      where: { id: request.id },
      data: {
        status,
        terminalReason,
        terminalAt: now,
      },
      select: matchRequestSummarySelect,
    });
  }

  private async assertCanCreatePendingMatchRequest(
    tx: Prisma.TransactionClient,
    input: PreparedMatchRequestCreation,
    now: Date,
  ) {
    await acquirePairLock(tx, input.seasonId, input.pairIdentity.pairKey);
    const sortedParticipants = [
      input.pairIdentity.pairMinParticipantId,
      input.pairIdentity.pairMaxParticipantId,
    ] as const;
    await acquireParticipantLocks(tx, input.seasonId, sortedParticipants);
    await this.assertPreparedParticipantsStillRequestable(tx, input, now);
    await expireDuePendingRequests(tx, input.seasonId, now);
    await assertNoLivePendingPair(tx, input.seasonId, input.pairIdentity);
    await assertNoLiveActiveMatchForParticipants(tx, input.seasonId, sortedParticipants);
    await assertPendingRequestLimit(tx, input.seasonId, input.requesterParticipantId);
    await assertDirectionLimit(
      tx,
      input.seasonId,
      input.requesterParticipantId,
      input.receiverParticipantId,
    );
    await assertDirectionCooldown(
      tx,
      input.seasonId,
      input.requesterParticipantId,
      input.receiverParticipantId,
      now,
    );
  }

  private async assertPreparedParticipantsStillRequestable(
    tx: Prisma.TransactionClient,
    input: PreparedMatchRequestCreation,
    now: Date,
  ) {
    const participants = await tx.seasonParticipant.findMany({
      where: {
        seasonId: input.seasonId,
        id: { in: [input.requesterParticipantId, input.receiverParticipantId] },
      },
      select: matchRequestCreationParticipantSelect,
    });
    const participantById = new Map(
      participants.map((participant) => [participant.id, participant]),
    );
    const requester = participantById.get(input.requesterParticipantId);
    const receiver = participantById.get(input.receiverParticipantId);
    const requesterReady = requester ? toReadyPolicyInput(requester) : false;
    const receiverReady = receiver ? toReadyPolicyInput(receiver) : false;
    if (
      !requester ||
      !receiver ||
      !requesterReady ||
      !receiverReady ||
      requester.dormitoryId === null ||
      requester.dormitoryId !== receiver.dormitoryId
    ) {
      throw matchesErrors.requestNotAllowed();
    }

    const [operation, snapshotCount] = await Promise.all([
      tx.seasonDormitoryOperation.findUnique({
        where: {
          seasonId_dormitoryId: {
            seasonId: input.seasonId,
            dormitoryId: requester.dormitoryId,
          },
        },
        select: {
          isOperated: true,
          roomSelectionDate: true,
        },
      }),
      tx.seasonParticipantProfileHistory.count({
        where: {
          seasonId: input.seasonId,
          participantId: { in: [input.requesterParticipantId, input.receiverParticipantId] },
          source: 'SEASON_REGISTRATION',
          registeredAtSnapshot: { not: null },
          redactedAt: null,
        },
      }),
    ]);

    if (
      !canPersistPreparedMatchRequest({
        requesterReady,
        receiverReady,
        requesterDormitoryId: requester.dormitoryId,
        receiverDormitoryId: receiver.dormitoryId,
        operationOperated: operation?.isOperated === true,
        roomSelectionOpen: formatKstDate(now) <= formatKstDate(operation?.roomSelectionDate ?? now),
        registrationSnapshotCount: snapshotCount,
      })
    ) {
      throw matchesErrors.requestNotAllowed();
    }
  }
}

export function getRequestTerminalNotAllowedError(status: TerminalMatchRequestStatus) {
  return status === 'REJECTED'
    ? matchesErrors.requestRejectNotAllowed()
    : matchesErrors.requestCancelNotAllowed();
}

function toReadyPolicyInput(participant: MatchRequestCreationParticipant) {
  const lifestyle = parseLifestyleOrNull(participant.profile ?? null);

  return isMatchRequestCreationParticipantReady({
    participationIntent: participant.participationIntent,
    registeredAt: participant.registeredAt,
    dormitoryId: participant.dormitoryId,
    dormitorySelectionState: participant.dormitorySelectionState,
    participantStatus: participant.participantStatus,
    declinedAt: participant.declinedAt,
    withdrawnAt: participant.withdrawnAt,
    hiddenByAdminAt: participant.hiddenByAdminAt,
    deactivatedAt: participant.deactivatedAt,
    userDeletedAt: participant.user.deletedAt,
    seasonProfileComplete: lifestyle !== null && isSeasonProfileComplete(lifestyle),
  });
}
