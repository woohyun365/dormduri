import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaService } from '../../../platform/database/prisma.service.js';
import {
  acquireTransactionAdvisoryLock,
  lockMatchRequestRow as lockMatchRequestRowSql,
} from '../../../generated/prisma/sql.js';
import { matchesErrors } from '../../matches.errors.js';
import { isCooldownActive } from '../../match.utils.js';

export type PairIdentity = {
  pairKey: string;
  pairMinParticipantId: string;
  pairMaxParticipantId: string;
};

export type MatchRequestClient = Prisma.TransactionClient | PrismaService;

export async function expireDuePendingRequests(
  client: MatchRequestClient,
  seasonId: string,
  now: Date,
) {
  await client.matchRequest.updateMany({
    where: {
      seasonId,
      status: 'PENDING',
      expiresAt: { lte: now },
    },
    data: {
      status: 'EXPIRED',
      terminalReason: 'EXPIRED',
      terminalAt: now,
    },
  });
}

export async function acquirePairLock(
  tx: Prisma.TransactionClient,
  seasonId: string,
  pairKey: string,
) {
  await tx.$queryRawTyped(
    acquireTransactionAdvisoryLock('match_request_pair', `${seasonId}:${pairKey}`),
  );
}

export async function acquireParticipantLocks(
  tx: Prisma.TransactionClient,
  seasonId: string,
  participantIds: readonly [string, string],
) {
  for (const participantId of participantIds) {
    await tx.$queryRawTyped(
      acquireTransactionAdvisoryLock('participant_active_match', `${seasonId}:${participantId}`),
    );
  }
}

export async function lockRequestRow(tx: Prisma.TransactionClient, requestId: string) {
  const rows = await tx.$queryRawTyped(lockMatchRequestRowSql(requestId));
  if (rows.length === 0) {
    throw matchesErrors.requestNotFound();
  }
}

export async function assertNoLivePendingPair(
  tx: Prisma.TransactionClient,
  seasonId: string,
  pairIdentity: PairIdentity,
) {
  const existingPendingRequest = await tx.matchRequest.findFirst({
    where: {
      seasonId,
      pairMinParticipantId: pairIdentity.pairMinParticipantId,
      pairMaxParticipantId: pairIdentity.pairMaxParticipantId,
      status: 'PENDING',
    },
    select: { id: true },
  });

  if (existingPendingRequest) {
    throw matchesErrors.requestAlreadyPending();
  }
}

export async function assertPendingRequestLimit(
  tx: Prisma.TransactionClient,
  seasonId: string,
  requesterParticipantId: string,
) {
  const pendingCount = await tx.matchRequest.count({
    where: {
      seasonId,
      requesterParticipantId,
      status: 'PENDING',
    },
  });

  if (pendingCount >= 3) {
    throw matchesErrors.requestPendingLimitReached();
  }
}

export async function assertDirectionLimit(
  tx: Prisma.TransactionClient,
  seasonId: string,
  requesterParticipantId: string,
  receiverParticipantId: string,
) {
  const directionCount = await tx.matchRequest.count({
    where: {
      seasonId,
      requesterParticipantId,
      receiverParticipantId,
    },
  });

  if (directionCount >= 5) {
    throw matchesErrors.requestDirectionLimitReached();
  }
}

export async function assertNoLiveActiveMatchForParticipants(
  tx: Prisma.TransactionClient,
  seasonId: string,
  participantIds: readonly [string, string],
) {
  const existingActiveMatch = await tx.activeMatch.findFirst({
    where: {
      seasonId,
      endedAt: null,
      OR: [
        { participantAId: { in: [...participantIds] } },
        { participantBId: { in: [...participantIds] } },
      ],
    },
    select: { id: true },
  });

  if (existingActiveMatch) {
    throw matchesErrors.activeMatchAlreadyExists();
  }
}

export async function assertDirectionCooldown(
  tx: Prisma.TransactionClient,
  seasonId: string,
  requesterParticipantId: string,
  receiverParticipantId: string,
  now: Date,
) {
  const latestTerminalRequest = await tx.matchRequest.findFirst({
    where: {
      seasonId,
      requesterParticipantId,
      receiverParticipantId,
      status: {
        in: ['REJECTED', 'CANCELLED_BY_REQUESTER', 'EXPIRED'],
      },
      terminalAt: { not: null },
    },
    orderBy: [{ terminalAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      terminalAt: true,
    },
  });
  const latestUnmatchedActive = await tx.activeMatch.findFirst({
    where: {
      seasonId,
      status: 'UNMATCHED',
      endedAt: { not: null },
      createdFromRequest: {
        requesterParticipantId,
        receiverParticipantId,
      },
    },
    orderBy: [{ endedAt: 'desc' }, { startedAt: 'desc' }],
    select: {
      endedAt: true,
    },
  });

  const cooldownReferenceAt = [latestTerminalRequest?.terminalAt, latestUnmatchedActive?.endedAt]
    .filter((value): value is Date => value instanceof Date)
    .sort((left, right) => right.getTime() - left.getTime())[0];

  if (cooldownReferenceAt && isCooldownActive(cooldownReferenceAt, now)) {
    throw matchesErrors.requestDirectionCooldownActive();
  }
}
