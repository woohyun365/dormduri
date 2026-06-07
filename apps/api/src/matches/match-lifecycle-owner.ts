import type { PrismaService } from '../platform/database/prisma.service.js';
import type { Campus } from '../generated/prisma/enums.js';
import type { CurrentSeasonContext } from '../seasons/ports/season-context.port.js';

interface LifecycleTransitionResult {
  expiredUnmatchRequests: number;
  seasonEndedActiveMatch: boolean;
}

interface MatchLifecycleOwnerDeps {
  prisma: PrismaService;
  getSeasonContextForCampus(
    cache: Map<Campus, CurrentSeasonContext | null>,
    campusCode: Campus,
    now: Date,
  ): Promise<CurrentSeasonContext | null>;
  transitionActiveMatchLifecycle(
    activeMatchId: string,
    seasonContext: CurrentSeasonContext | null,
    now: Date,
  ): Promise<LifecycleTransitionResult>;
}

export function createMatchLifecycleOwner(deps: MatchLifecycleOwnerDeps) {
  return {
    async sweepLifecycleTransitions(now: Date) {
      const expiredRequests = await deps.prisma.matchRequest.updateMany({
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

      const activeMatches = await deps.prisma.activeMatch.findMany({
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
        const seasonContext = await deps.getSeasonContextForCampus(
          seasonContextCache,
          activeMatch.season.campusCode,
          now,
        );
        const transitionResult = await deps.transitionActiveMatchLifecycle(
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
    },
  };
}
