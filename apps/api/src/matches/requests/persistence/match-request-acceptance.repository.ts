import { Injectable } from '@nestjs/common';
import { isSeasonProfileComplete } from '@repo/shared/lifestyle';
import { Prisma } from '../../../generated/prisma/client.js';
import type { CurrentSeasonContext } from '../../../seasons/ports/season-context.port.js';
import { formatKstDate } from '../../../platform/time/kst-date.js';
import { parseLifestyleOrNull } from '../../../profiles/profile.mapper.js';
import {
  activeMatchSummarySelect,
  type ActiveMatchRecord,
} from '../../active/persistence/active-match.select.js';
import { buildParticipantPairIdentity } from '../../match.utils.js';
import { matchesErrors } from '../../matches.errors.js';
import {
  acquireParticipantLocks,
  assertNoLiveActiveMatchForParticipants,
  lockRequestRow,
} from './match-request-locks.js';
import { matchRequestSummarySelect, type MatchRequestRecord } from './match-request.select.js';
import {
  resolveMatchRequestAcceptancePrecondition,
  type MatchRequestAcceptanceParticipantPolicyInput,
} from '../policies/match-request-acceptance.policy.js';

export type AcceptableMatchRequestLoadResult =
  | {
      kind: 'ACCEPTABLE';
      request: MatchRequestRecord;
      pairIdentity: ReturnType<typeof buildParticipantPairIdentity>;
    }
  | {
      kind: 'TERMINAL';
      request: MatchRequestRecord;
    };

@Injectable()
export class MatchRequestAcceptanceRepository {
  async lockAndLoadAcceptableRequest(
    tx: Prisma.TransactionClient,
    requestId: string,
    receiverParticipantId: string,
    now: Date,
    seasonContext: CurrentSeasonContext,
  ): Promise<AcceptableMatchRequestLoadResult> {
    await lockRequestRow(tx, requestId);

    const request = await this.loadPendingReceiverRequest(
      tx,
      requestId,
      receiverParticipantId,
      now,
    );
    const sortedParticipants = sortParticipantIds(
      request.requesterParticipantId,
      request.receiverParticipantId,
    );
    await acquireParticipantLocks(tx, request.seasonId, sortedParticipants);

    const lockedRequest = await this.loadPendingReceiverRequest(
      tx,
      requestId,
      receiverParticipantId,
      now,
    );
    const precondition = await this.resolvePrecondition(tx, lockedRequest, seasonContext, now);
    if (precondition.kind === 'TERMINAL') {
      return {
        kind: 'TERMINAL',
        request: await this.systemCancelRequest(
          tx,
          lockedRequest,
          precondition.terminalReason,
          now,
        ),
      };
    }

    await assertNoLiveActiveMatchForParticipants(tx, lockedRequest.seasonId, sortedParticipants);

    return {
      kind: 'ACCEPTABLE',
      request: lockedRequest,
      pairIdentity: buildParticipantPairIdentity(
        lockedRequest.requesterParticipantId,
        lockedRequest.receiverParticipantId,
      ),
    };
  }

  async acceptRequestAndCreateActiveMatch(
    tx: Prisma.TransactionClient,
    input: {
      request: MatchRequestRecord;
      pairIdentity: ReturnType<typeof buildParticipantPairIdentity>;
    },
    now: Date,
  ): Promise<{
    acceptedRequest: MatchRequestRecord;
    activeMatchRecord: ActiveMatchRecord;
  }> {
    await tx.matchRequest.update({
      where: { id: input.request.id },
      data: {
        status: 'ACCEPTED',
        terminalReason: 'ACCEPTED',
        acceptedAt: now,
        terminalAt: now,
      },
    });

    let activeMatchRecord: ActiveMatchRecord;
    try {
      activeMatchRecord = (await tx.activeMatch.create({
        data: {
          seasonId: input.request.seasonId,
          pairKey: input.pairIdentity.pairKey,
          participantAId: input.pairIdentity.pairMinParticipantId,
          participantBId: input.pairIdentity.pairMaxParticipantId,
          createdFromRequestId: input.request.id,
          status: 'ACTIVE',
          startedAt: now,
        },
        select: activeMatchSummarySelect,
      })) as ActiveMatchRecord;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw matchesErrors.activeMatchAlreadyExists();
      }
      throw error;
    }

    await tx.seasonParticipant.updateMany({
      where: {
        id: { in: [input.request.requesterParticipantId, input.request.receiverParticipantId] },
      },
      data: {
        participantStatus: 'MATCHED',
        matchedAt: now,
      },
    });

    const acceptedRequest: MatchRequestRecord = {
      ...input.request,
      status: 'ACCEPTED',
      terminalReason: 'ACCEPTED',
      acceptedAt: now,
      terminalAt: now,
    };

    return { acceptedRequest, activeMatchRecord };
  }

  async cancelOtherPendingRequestsAfterActiveMatch(
    tx: Prisma.TransactionClient,
    request: MatchRequestRecord,
    now: Date,
  ) {
    await tx.matchRequest.updateMany({
      where: {
        seasonId: request.seasonId,
        status: 'PENDING',
        id: { not: request.id },
        OR: [
          {
            requesterParticipantId: {
              in: [request.requesterParticipantId, request.receiverParticipantId],
            },
          },
          {
            receiverParticipantId: {
              in: [request.requesterParticipantId, request.receiverParticipantId],
            },
          },
        ],
      },
      data: {
        status: 'CANCELLED_BY_SYSTEM',
        terminalReason: 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH',
        terminalAt: now,
      },
    });
  }

  private async loadPendingReceiverRequest(
    tx: Prisma.TransactionClient,
    requestId: string,
    receiverParticipantId: string,
    now: Date,
  ): Promise<MatchRequestRecord> {
    const request = (await tx.matchRequest.findUnique({
      where: { id: requestId },
      select: matchRequestSummarySelect,
    })) as MatchRequestRecord | null;
    if (!request) {
      throw matchesErrors.requestNotFound();
    }
    if (request.status !== 'PENDING') {
      throw matchesErrors.requestNotPending();
    }
    if (request.receiverParticipantId !== receiverParticipantId) {
      throw matchesErrors.requestAcceptNotAllowed();
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

    return request;
  }

  private async resolvePrecondition(
    tx: Prisma.TransactionClient,
    request: MatchRequestRecord,
    seasonContext: CurrentSeasonContext,
    now: Date,
  ) {
    const registrationSnapshotCount = await tx.seasonParticipantProfileHistory.count({
      where: {
        participantId: {
          in: [request.requesterParticipantId, request.receiverParticipantId],
        },
        seasonId: request.seasonId,
        source: 'SEASON_REGISTRATION',
        registeredAtSnapshot: { not: null },
        redactedAt: null,
      },
    });
    const operation = request.requesterParticipant.dormitoryId
      ? seasonContext.operatedDormitories.find(
          (item) =>
            item.isOperated && item.dormitoryId === request.requesterParticipant.dormitoryId,
        )
      : null;

    return resolveMatchRequestAcceptancePrecondition({
      requester: toAcceptanceParticipantPolicyInput(request.requesterParticipant),
      receiver: toAcceptanceParticipantPolicyInput(request.receiverParticipant),
      sameDormitory:
        request.requesterParticipant.dormitoryId !== null &&
        request.requesterParticipant.dormitoryId === request.receiverParticipant.dormitoryId,
      seasonMatching: seasonContext.state === 'SEASON_MATCHING',
      roomSelectionOpen: operation ? formatKstDate(now) <= operation.roomSelectionDate : false,
      registrationSnapshotCount,
    });
  }

  private async systemCancelRequest(
    tx: Prisma.TransactionClient,
    request: MatchRequestRecord,
    terminalReason: 'WITHDRAWN_PARTICIPANT' | 'MATCH_PRECONDITION_FAILED',
    now: Date,
  ): Promise<MatchRequestRecord> {
    return (await tx.matchRequest.update({
      where: { id: request.id },
      data: {
        status: 'CANCELLED_BY_SYSTEM',
        terminalReason,
        terminalAt: now,
      },
      select: matchRequestSummarySelect,
    })) as MatchRequestRecord;
  }
}

function sortParticipantIds(
  firstParticipantId: string,
  secondParticipantId: string,
): readonly [string, string] {
  return firstParticipantId <= secondParticipantId
    ? ([firstParticipantId, secondParticipantId] as const)
    : ([secondParticipantId, firstParticipantId] as const);
}

function toAcceptanceParticipantPolicyInput(
  participant: MatchRequestRecord['requesterParticipant'],
): MatchRequestAcceptanceParticipantPolicyInput {
  const lifestyle = parseLifestyleOrNull(participant.profile ?? null);

  return {
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
  };
}
