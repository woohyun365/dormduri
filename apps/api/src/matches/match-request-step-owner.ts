import { isSeasonProfileComplete } from '@repo/shared/lifestyle';
import { Prisma } from '../generated/prisma/client.js';
import type { ChatService } from '../chat/application/chat.service.js';
import { matchesErrors } from './matches.errors.js';
import type { MatchRequestRecord, ActiveMatchRecord } from './match-selects.js';
import { activeMatchSummarySelect, matchRequestSummarySelect } from './match-selects.js';
import {
  acquireParticipantLocks,
  assertNoLiveActiveMatchForParticipants,
  lockRequestRow,
} from './match-transaction-helpers.js';
import { buildParticipantPairIdentity } from './match.utils.js';
import type { CurrentSeasonContext } from '../seasons/season.types.js';
import { formatKstDate } from '../seasons/season.utils.js';
import { parseLifestyleOrNull } from '../profiles/profile.mapper.js';

export type TerminalMatchRequestStatus = 'REJECTED' | 'CANCELLED_BY_REQUESTER';
export type TerminalMatchRequestReason = 'REJECTED_BY_RECEIVER' | 'CANCELLED_BY_REQUESTER';

type MatchRequestParticipantState = MatchRequestRecord['requesterParticipant'];

function isWithdrawnMatchRequestParticipant(participant: MatchRequestParticipantState) {
  return (
    participant.participationIntent === 'DECLINED' ||
    participant.participantStatus === 'WITHDRAWN' ||
    (participant.withdrawnAt !== null && participant.withdrawnAt !== undefined) ||
    (participant.declinedAt !== null && participant.declinedAt !== undefined)
  );
}

async function systemCancelWithdrawnParticipantRequest(
  tx: Prisma.TransactionClient,
  request: MatchRequestRecord,
  now: Date,
): Promise<MatchRequestRecord> {
  return (await tx.matchRequest.update({
    where: { id: request.id },
    data: {
      status: 'CANCELLED_BY_SYSTEM',
      terminalReason: 'WITHDRAWN_PARTICIPANT',
      terminalAt: now,
    },
    select: matchRequestSummarySelect,
  })) as MatchRequestRecord;
}

async function systemCancelInvalidParticipantStateRequest(
  tx: Prisma.TransactionClient,
  request: MatchRequestRecord,
  now: Date,
): Promise<MatchRequestRecord> {
  return (await tx.matchRequest.update({
    where: { id: request.id },
    data: {
      status: 'CANCELLED_BY_SYSTEM',
      terminalReason: 'MATCH_PRECONDITION_FAILED',
      terminalAt: now,
    },
    select: matchRequestSummarySelect,
  })) as MatchRequestRecord;
}

function isRegistrationCompleteMatchRequestParticipant(participant: MatchRequestParticipantState) {
  const lifestyle = parseLifestyleOrNull(participant.profile ?? null);

  return (
    participant.participationIntent === 'REGISTERED' &&
    participant.registeredAt !== null &&
    participant.dormitorySelectionState === 'ASSIGNED' &&
    participant.dormitoryId !== null &&
    participant.declinedAt === null &&
    participant.withdrawnAt === null &&
    participant.participantStatus !== 'WITHDRAWN' &&
    participant.participantStatus !== 'EXPIRED' &&
    participant.hiddenByAdminAt === null &&
    participant.deactivatedAt === null &&
    participant.user.deletedAt === null &&
    lifestyle !== null &&
    isSeasonProfileComplete(lifestyle)
  );
}

async function hasRegistrationSnapshotsForRequest(
  tx: Prisma.TransactionClient,
  request: MatchRequestRecord,
) {
  const snapshotCount = await tx.seasonParticipantProfileHistory.count({
    where: {
      participantId: {
        in: [request.requesterParticipantId, request.receiverParticipantId],
      },
      seasonId: request.seasonId,
      source: 'SEASON_REGISTRATION',
      registeredAtSnapshot: {
        not: null,
      },
      redactedAt: null,
    },
  });

  return snapshotCount === 2;
}

function canParticipantsStillMatchInSeason(
  request: MatchRequestRecord,
  seasonContext: CurrentSeasonContext,
  now: Date,
) {
  if (seasonContext.state !== 'SEASON_MATCHING') {
    return false;
  }
  if (
    request.requesterParticipant.dormitoryId === null ||
    request.receiverParticipant.dormitoryId === null ||
    request.requesterParticipant.dormitoryId !== request.receiverParticipant.dormitoryId
  ) {
    return false;
  }

  const operation = seasonContext.operatedDormitories.find(
    (item) => item.isOperated && item.dormitoryId === request.requesterParticipant.dormitoryId,
  );
  if (!operation) {
    return false;
  }

  return formatKstDate(now) <= operation.roomSelectionDate;
}

export function getRequestTerminalNotAllowedError(status: TerminalMatchRequestStatus) {
  return status === 'REJECTED'
    ? matchesErrors.requestRejectNotAllowed()
    : matchesErrors.requestCancelNotAllowed();
}

export async function loadTerminableMatchRequest(
  tx: Prisma.TransactionClient,
  requestId: string,
  actingParticipantId: string,
  status: TerminalMatchRequestStatus,
  now: Date,
): Promise<MatchRequestRecord> {
  await lockRequestRow(tx, requestId);

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
  if (status === 'REJECTED' && request.receiverParticipantId !== actingParticipantId) {
    throw matchesErrors.requestRejectNotAllowed();
  }
  if (
    status === 'CANCELLED_BY_REQUESTER' &&
    request.requesterParticipantId !== actingParticipantId
  ) {
    throw matchesErrors.requestCancelNotAllowed();
  }

  return request;
}

export async function executeTerminalMatchRequestUpdate(
  tx: Prisma.TransactionClient,
  request: MatchRequestRecord,
  status: TerminalMatchRequestStatus,
  terminalReason: TerminalMatchRequestReason,
  now: Date,
): Promise<MatchRequestRecord> {
  return (await tx.matchRequest.update({
    where: { id: request.id },
    data: {
      status,
      terminalReason,
      terminalAt: now,
    },
    select: matchRequestSummarySelect,
  })) as MatchRequestRecord;
}

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

export async function loadAcceptableMatchRequest(
  tx: Prisma.TransactionClient,
  requestId: string,
  receiverParticipantId: string,
  now: Date,
  seasonContext: CurrentSeasonContext,
): Promise<AcceptableMatchRequestLoadResult> {
  await lockRequestRow(tx, requestId);

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

  const sortedParticipants =
    request.requesterParticipantId <= request.receiverParticipantId
      ? ([request.requesterParticipantId, request.receiverParticipantId] as const)
      : ([request.receiverParticipantId, request.requesterParticipantId] as const);
  await acquireParticipantLocks(tx, request.seasonId, sortedParticipants);

  const lockedRequest = (await tx.matchRequest.findUnique({
    where: { id: requestId },
    select: matchRequestSummarySelect,
  })) as MatchRequestRecord | null;
  if (!lockedRequest) {
    throw matchesErrors.requestNotFound();
  }
  if (lockedRequest.status !== 'PENDING') {
    throw matchesErrors.requestNotPending();
  }
  if (lockedRequest.expiresAt.getTime() <= now.getTime()) {
    await tx.matchRequest.update({
      where: { id: lockedRequest.id },
      data: {
        status: 'EXPIRED',
        terminalReason: 'EXPIRED',
        terminalAt: now,
      },
    });
    throw matchesErrors.requestExpired();
  }
  if (
    isWithdrawnMatchRequestParticipant(lockedRequest.requesterParticipant) ||
    isWithdrawnMatchRequestParticipant(lockedRequest.receiverParticipant)
  ) {
    return {
      kind: 'TERMINAL',
      request: await systemCancelWithdrawnParticipantRequest(tx, lockedRequest, now),
    };
  }
  if (
    !isRegistrationCompleteMatchRequestParticipant(lockedRequest.requesterParticipant) ||
    !isRegistrationCompleteMatchRequestParticipant(lockedRequest.receiverParticipant) ||
    !(await hasRegistrationSnapshotsForRequest(tx, lockedRequest)) ||
    !canParticipantsStillMatchInSeason(lockedRequest, seasonContext, now)
  ) {
    return {
      kind: 'TERMINAL',
      request: await systemCancelInvalidParticipantStateRequest(tx, lockedRequest, now),
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

export async function executeAcceptMatchRequest(
  tx: Prisma.TransactionClient,
  chatService: ChatService,
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

  await chatService.handleActiveMatchCreated(
    tx,
    {
      seasonId: input.request.seasonId,
      pairKey: input.pairIdentity.pairKey,
      participantAId: input.pairIdentity.pairMinParticipantId,
      participantBId: input.pairIdentity.pairMaxParticipantId,
      activeMatchId: activeMatchRecord.id,
    },
    now,
  );

  await tx.matchRequest.updateMany({
    where: {
      seasonId: input.request.seasonId,
      status: 'PENDING',
      id: { not: input.request.id },
      OR: [
        {
          requesterParticipantId: {
            in: [input.request.requesterParticipantId, input.request.receiverParticipantId],
          },
        },
        {
          receiverParticipantId: {
            in: [input.request.requesterParticipantId, input.request.receiverParticipantId],
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

  const acceptedRequest: MatchRequestRecord = {
    ...input.request,
    status: 'ACCEPTED',
    terminalReason: 'ACCEPTED',
    acceptedAt: now,
    terminalAt: now,
  };

  return {
    acceptedRequest,
    activeMatchRecord,
  };
}
