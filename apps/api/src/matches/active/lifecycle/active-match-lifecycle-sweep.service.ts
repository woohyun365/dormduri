import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import type { Campus } from '../../../generated/prisma/enums.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import {
  SEASON_CONTEXT_PORT,
  type CurrentSeasonContext,
  type SeasonContextPort,
} from '../../../seasons/ports/season-context.port.js';
import type {
  MatchLifecycleSweepPort,
  MatchLifecycleSweepResult,
} from '../../application/ports/match-lifecycle-sweep.port.js';
import { ActiveMatchRepository } from '../persistence/active-match.repository.js';

interface LifecycleTransitionResult {
  expiredUnmatchRequests: number;
  seasonEndedActiveMatch: boolean;
}

@Injectable()
export class ActiveMatchLifecycleSweepService implements MatchLifecycleSweepPort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly activeMatchRepository: ActiveMatchRepository,
  ) {}

  async sweepMatchLifecycleTransitions(now: Date): Promise<MatchLifecycleSweepResult> {
    const expiredRequests = await this.prisma.matchRequest.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lte: now },
      },
      data: {
        status: 'EXPIRED',
        terminalReason: 'EXPIRED',
        terminalAt: now,
      },
    });

    const activeMatches = await this.prisma.activeMatch.findMany({
      where: {
        status: 'ACTIVE',
        endedAt: null,
      },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        seasonId: true,
        season: {
          select: {
            campusCode: true,
          },
        },
      },
    });

    const seasonContextCache = new Map<Campus, CurrentSeasonContext | null>();
    let expiredUnmatchRequests = 0;
    let seasonEndedActiveMatches = 0;

    for (const activeMatch of activeMatches) {
      const seasonContext = await this.getSeasonContextForCampus(
        seasonContextCache,
        activeMatch.season.campusCode,
        now,
      );
      const transitionResult = await this.transitionActiveMatchLifecycle(
        activeMatch.id,
        seasonContext,
        now,
      );

      expiredUnmatchRequests += transitionResult.expiredUnmatchRequests;
      if (transitionResult.seasonEndedActiveMatch) {
        seasonEndedActiveMatches += 1;
      }
    }

    return {
      expiredRequests: expiredRequests.count,
      expiredUnmatchRequests,
      seasonEndedActiveMatches,
    };
  }

  private async getSeasonContextForCampus(
    cache: Map<Campus, CurrentSeasonContext | null>,
    campusCode: Campus,
    now: Date,
  ) {
    const cachedSeasonContext = cache.get(campusCode);
    if (cachedSeasonContext !== undefined) {
      return cachedSeasonContext;
    }

    const seasonContext = await this.seasonsService.getCurrentSeasonContext(campusCode, now);
    cache.set(campusCode, seasonContext);
    return seasonContext;
  }

  private async transitionActiveMatchLifecycle(
    activeMatchId: string,
    seasonContext: CurrentSeasonContext | null,
    now: Date,
  ): Promise<LifecycleTransitionResult> {
    return this.prisma.runSerializableTransaction(async (tx) => {
      const currentActiveMatch = await this.activeMatchRepository.lockAndFindActiveMatch(
        tx,
        activeMatchId,
      );

      if (!currentActiveMatch || currentActiveMatch.status !== 'ACTIVE') {
        return { expiredUnmatchRequests: 0, seasonEndedActiveMatch: false };
      }

      const pendingBefore = currentActiveMatch.unmatchRequests.filter(
        (request) => request.status === 'PENDING',
      ).length;
      const shouldSeasonEnd =
        !seasonContext || seasonContext.season.id !== currentActiveMatch.seasonId;

      if (shouldSeasonEnd) {
        return this.endSeasonForActiveMatch(tx, currentActiveMatch.id, pendingBefore, now);
      }

      if (pendingBefore === 0) {
        return { expiredUnmatchRequests: 0, seasonEndedActiveMatch: false };
      }

      const synchronizedActiveMatch =
        await this.activeMatchRepository.synchronizePendingUnmatchRequests(
          tx,
          currentActiveMatch,
          seasonContext,
          now,
        );
      const pendingAfter = synchronizedActiveMatch.unmatchRequests.filter(
        (request) => request.status === 'PENDING',
      ).length;

      return {
        expiredUnmatchRequests: pendingBefore - pendingAfter,
        seasonEndedActiveMatch: false,
      };
    });
  }

  private async endSeasonForActiveMatch(
    tx: Prisma.TransactionClient,
    activeMatchId: string,
    pendingBefore: number,
    now: Date,
  ): Promise<LifecycleTransitionResult> {
    const expiredPendingRequests = pendingBefore
      ? await tx.activeMatchUnmatchRequest.updateMany({
          where: {
            activeMatchId,
            status: 'PENDING',
          },
          data: {
            status: 'EXPIRED_BY_CUTOFF',
            terminalAt: now,
          },
        })
      : { count: 0 };

    await tx.activeMatch.update({
      where: { id: activeMatchId },
      data: {
        status: 'SEASON_ENDED',
        endedAt: now,
        endReason: 'SEASON_ENDED',
      },
    });

    return {
      expiredUnmatchRequests: expiredPendingRequests.count,
      seasonEndedActiveMatch: true,
    };
  }
}
