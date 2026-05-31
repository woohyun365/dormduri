import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import { matchesErrors } from './matches.errors.js';
import { isUnmatchWindowOpen } from './match-read-model.js';
import { activeMatchCommandSelect, type ActiveMatchCommandRecord } from './match-selects.js';
import { acquireActiveMatchLock, lockActiveMatchRow } from './match-transaction-helpers.js';
import type { CurrentSeasonContext } from '../seasons/season.types.js';

type MatchClient = Prisma.TransactionClient | PrismaService;

export async function reloadActiveMatchOrThrow(
  tx: Prisma.TransactionClient,
  activeMatchId: string,
): Promise<ActiveMatchCommandRecord> {
  const activeMatch = await tx.activeMatch.findUnique({
    where: { id: activeMatchId },
    select: activeMatchCommandSelect,
  });

  if (!activeMatch) {
    throw matchesErrors.activeMatchNotFound();
  }

  return activeMatch;
}

export async function synchronizePendingUnmatchRequests(
  client: MatchClient,
  activeMatch: ActiveMatchCommandRecord,
  seasonContext: CurrentSeasonContext,
  now: Date,
): Promise<ActiveMatchCommandRecord> {
  const hasPendingRequests = activeMatch.unmatchRequests.some(
    (request) => request.status === 'PENDING',
  );

  if (
    activeMatch.status !== 'ACTIVE' ||
    !hasPendingRequests ||
    isUnmatchWindowOpen(activeMatch, seasonContext, now)
  ) {
    return activeMatch;
  }

  await client.activeMatchUnmatchRequest.updateMany({
    where: {
      activeMatchId: activeMatch.id,
      status: 'PENDING',
    },
    data: {
      status: 'EXPIRED_BY_CUTOFF',
      terminalAt: now,
    },
  });

  const refreshed = await client.activeMatch.findUnique({
    where: { id: activeMatch.id },
    select: activeMatchCommandSelect,
  });

  if (!refreshed) {
    throw matchesErrors.activeMatchNotFound();
  }

  return refreshed;
}

export function assertUnmatchActorAllowed(
  activeMatch: ActiveMatchCommandRecord,
  participantId: string,
  errorFactory: () => Error,
) {
  if (
    activeMatch.status !== 'ACTIVE' ||
    activeMatch.endedAt !== null ||
    (activeMatch.participantAId !== participantId && activeMatch.participantBId !== participantId)
  ) {
    throw errorFactory();
  }
}

export function assertCurrentSeasonActiveMatch(
  activeMatch: ActiveMatchCommandRecord,
  currentSeasonId: string,
) {
  if (activeMatch.seasonId !== currentSeasonId) {
    throw matchesErrors.unmatchRequestNotAllowed();
  }
}

export function assertUnmatchWindowOpen(
  activeMatch: ActiveMatchCommandRecord,
  seasonContext: CurrentSeasonContext,
  now: Date,
) {
  if (!isUnmatchWindowOpen(activeMatch, seasonContext, now)) {
    throw matchesErrors.unmatchRequestNotAllowed(
      '매칭 취소는 같은 기숙사의 roomSelectionDate 전까지만 요청할 수 있습니다.',
    );
  }
}

export async function loadValidatedActiveMatchForUnmatch(
  tx: Prisma.TransactionClient,
  activeMatchId: string,
  seasonContext: CurrentSeasonContext,
  now: Date,
): Promise<ActiveMatchCommandRecord> {
  await acquireActiveMatchLock(tx, activeMatchId);
  await lockActiveMatchRow(tx, activeMatchId);

  const activeMatch = await reloadActiveMatchOrThrow(tx, activeMatchId);
  const synchronizedActiveMatch = await synchronizePendingUnmatchRequests(
    tx,
    activeMatch,
    seasonContext,
    now,
  );

  assertCurrentSeasonActiveMatch(synchronizedActiveMatch, seasonContext.season.id);
  assertUnmatchWindowOpen(synchronizedActiveMatch, seasonContext, now);

  return synchronizedActiveMatch;
}
