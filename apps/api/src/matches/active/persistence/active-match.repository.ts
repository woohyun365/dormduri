import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaService } from '../../../platform/database/prisma.service.js';
import type { CurrentSeasonContext } from '../../../seasons/ports/season-context.port.js';
import { matchesErrors } from '../../matches.errors.js';
import {
  assertCurrentSeasonActiveMatch,
  assertUnmatchWindowOpen,
  isUnmatchWindowOpen,
} from '../policies/active-match-unmatch.policy.js';
import { acquireActiveMatchLock, lockActiveMatchRow } from './active-match-locks.js';
import { activeMatchCommandSelect, type ActiveMatchCommandRecord } from './active-match.select.js';

const activeMatchUnmatchRequestLifecycleSelect = {
  id: true,
  participantId: true,
  status: true,
  requestedAt: true,
  terminalAt: true,
} as const satisfies Prisma.ActiveMatchUnmatchRequestSelect;

export type ActiveMatchUnmatchRequestLifecycleRecord = Prisma.ActiveMatchUnmatchRequestGetPayload<{
  select: typeof activeMatchUnmatchRequestLifecycleSelect;
}>;

type MatchClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ActiveMatchRepository {
  async acquireActiveMatchLock(tx: Prisma.TransactionClient, activeMatchId: string) {
    await acquireActiveMatchLock(tx, activeMatchId);
  }

  async lockActiveMatchRow(tx: Prisma.TransactionClient, activeMatchId: string) {
    await lockActiveMatchRow(tx, activeMatchId);
  }

  async lockAndFindActiveMatch(
    tx: Prisma.TransactionClient,
    activeMatchId: string,
  ): Promise<ActiveMatchCommandRecord | null> {
    await this.acquireActiveMatchLock(tx, activeMatchId);
    await this.lockActiveMatchRow(tx, activeMatchId);

    return tx.activeMatch.findUnique({
      where: { id: activeMatchId },
      select: activeMatchCommandSelect,
    });
  }

  async reloadActiveMatchOrThrow(
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

  async synchronizePendingUnmatchRequests(
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

  async loadValidatedActiveMatchForUnmatch(
    tx: Prisma.TransactionClient,
    activeMatchId: string,
    seasonContext: CurrentSeasonContext,
    now: Date,
  ): Promise<ActiveMatchCommandRecord> {
    const activeMatch = await this.lockAndFindActiveMatch(tx, activeMatchId);

    if (!activeMatch) {
      throw matchesErrors.activeMatchNotFound();
    }

    const synchronizedActiveMatch = await this.synchronizePendingUnmatchRequests(
      tx,
      activeMatch,
      seasonContext,
      now,
    );

    assertCurrentSeasonActiveMatch(synchronizedActiveMatch, seasonContext.season.id, () =>
      matchesErrors.unmatchRequestNotAllowed(),
    );
    assertUnmatchWindowOpen(synchronizedActiveMatch, seasonContext, now, () =>
      matchesErrors.unmatchRequestNotAllowed(
        '매칭 취소는 같은 기숙사의 roomSelectionDate 전까지만 요청할 수 있습니다.',
      ),
    );

    return synchronizedActiveMatch;
  }

  async createPendingUnmatchRequest(
    tx: Prisma.TransactionClient,
    activeMatchId: string,
    participantId: string,
    now: Date,
  ): Promise<ActiveMatchUnmatchRequestLifecycleRecord> {
    try {
      return await tx.activeMatchUnmatchRequest.create({
        data: {
          activeMatchId,
          participantId,
          status: 'PENDING',
          requestedAt: now,
        },
        select: activeMatchUnmatchRequestLifecycleSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw matchesErrors.unmatchRequestAlreadySubmitted();
      }
      throw error;
    }
  }

  async findPendingUnmatchRequests(tx: Prisma.TransactionClient, activeMatchId: string) {
    return tx.activeMatchUnmatchRequest.findMany({
      where: {
        activeMatchId,
        status: 'PENDING',
      },
      select: activeMatchUnmatchRequestLifecycleSelect,
    });
  }

  async fulfillMutualUnmatch(
    tx: Prisma.TransactionClient,
    activeMatch: ActiveMatchCommandRecord,
    now: Date,
  ): Promise<ActiveMatchCommandRecord> {
    await tx.activeMatchUnmatchRequest.updateMany({
      where: {
        activeMatchId: activeMatch.id,
        status: 'PENDING',
      },
      data: {
        status: 'FULFILLED_BY_MUTUAL_CONSENT',
        terminalAt: now,
      },
    });

    await tx.seasonParticipant.updateMany({
      where: {
        id: {
          in: [activeMatch.participantAId, activeMatch.participantBId],
        },
      },
      data: {
        participantStatus: 'ACTIVE',
        matchedAt: null,
      },
    });

    return tx.activeMatch.update({
      where: { id: activeMatch.id },
      data: {
        status: 'UNMATCHED',
        endedAt: now,
        endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
      },
      select: activeMatchCommandSelect,
    });
  }

  async findViewerPendingUnmatchRequest(
    tx: Prisma.TransactionClient,
    activeMatchId: string,
    participantId: string,
  ) {
    const [viewerPendingRequest] = await tx.activeMatchUnmatchRequest.findMany({
      where: {
        activeMatchId,
        participantId,
        status: 'PENDING',
      },
      orderBy: [{ requestedAt: 'desc' }, { createdAt: 'desc' }],
      select: activeMatchUnmatchRequestLifecycleSelect,
    });

    return viewerPendingRequest ?? null;
  }

  async cancelViewerPendingUnmatchRequest(
    tx: Prisma.TransactionClient,
    unmatchRequestId: string,
    now: Date,
  ): Promise<ActiveMatchUnmatchRequestLifecycleRecord> {
    return tx.activeMatchUnmatchRequest.update({
      where: { id: unmatchRequestId },
      data: {
        status: 'CANCELLED_BY_REQUESTER',
        terminalAt: now,
      },
      select: activeMatchUnmatchRequestLifecycleSelect,
    });
  }
}
