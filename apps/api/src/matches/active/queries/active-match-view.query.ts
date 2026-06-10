import { Injectable } from '@nestjs/common';
import type { ActiveMatchSummary } from '@repo/shared/match-contract';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import type { CurrentSeasonContext } from '../../../seasons/ports/season-context.port.js';
import type { MatchActiveViewPort } from '../../application/ports/match-active-view.port.js';
import { matchesErrors } from '../../matches.errors.js';
import { toActiveMatchSummary, toDetailedActiveMatchSummary } from '../../match-read-model.js';
import {
  activeMatchCommandSelect,
  activeMatchSummarySelect,
  type ActiveMatchCommandRecord,
} from '../persistence/active-match.select.js';
import { ActiveMatchRepository } from '../persistence/active-match.repository.js';

@Injectable()
export class ActiveMatchViewQuery implements MatchActiveViewPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activeMatchRepository: ActiveMatchRepository,
  ) {}

  async getCurrentActiveMatchByParticipantId(
    seasonId: string,
    participantId: string,
  ): Promise<ActiveMatchSummary | null> {
    const activeMatchMap = await this.getLiveActiveMatchMapForParticipantIds(seasonId, [
      participantId,
    ]);
    return activeMatchMap.get(participantId) ?? null;
  }

  async getCurrentActiveMatchSummaryForParticipant(
    seasonContext: CurrentSeasonContext,
    participantId: string,
    now: Date,
  ): Promise<ActiveMatchSummary | null> {
    const activeMatch = await this.getCurrentDetailedActiveMatchByParticipantId(
      seasonContext.season.id,
      participantId,
    );
    if (!activeMatch) return null;

    const synchronizedActiveMatch =
      await this.activeMatchRepository.synchronizePendingUnmatchRequests(
        this.prisma,
        activeMatch,
        seasonContext,
        now,
      );

    return toDetailedActiveMatchSummary(synchronizedActiveMatch, participantId, seasonContext, now);
  }

  async getCurrentDetailedActiveMatchByParticipantId(
    seasonId: string,
    participantId: string,
  ): Promise<ActiveMatchCommandRecord | null> {
    return this.prisma.activeMatch.findFirst({
      where: {
        seasonId,
        endedAt: null,
        OR: [{ participantAId: participantId }, { participantBId: participantId }],
      },
      select: activeMatchCommandSelect,
    });
  }

  async getDetailedActiveMatchSummaryForViewer(
    client: PrismaService | Prisma.TransactionClient,
    activeMatchId: string,
    viewerParticipantId: string,
    seasonContext: CurrentSeasonContext,
    now: Date,
  ): Promise<ActiveMatchSummary> {
    const activeMatch = await client.activeMatch.findUnique({
      where: { id: activeMatchId },
      select: activeMatchCommandSelect,
    });

    if (!activeMatch) {
      throw matchesErrors.activeMatchNotFound();
    }

    const synchronizedActiveMatch =
      await this.activeMatchRepository.synchronizePendingUnmatchRequests(
        client,
        activeMatch,
        seasonContext,
        now,
      );

    return toDetailedActiveMatchSummary(
      synchronizedActiveMatch,
      viewerParticipantId,
      seasonContext,
      now,
    );
  }

  async getLiveActiveMatchMapForParticipantIds(
    seasonId: string,
    participantIds: string[],
  ): Promise<Map<string, ActiveMatchSummary>> {
    if (participantIds.length === 0) {
      return new Map();
    }

    const activeMatches = await this.prisma.activeMatch.findMany({
      where: {
        seasonId,
        endedAt: null,
        OR: [
          { participantAId: { in: participantIds } },
          { participantBId: { in: participantIds } },
        ],
      },
      select: activeMatchSummarySelect,
    });

    const map = new Map<string, ActiveMatchSummary>();
    for (const activeMatch of activeMatches) {
      map.set(
        activeMatch.participantAId,
        toActiveMatchSummary(activeMatch, activeMatch.participantAId),
      );
      map.set(
        activeMatch.participantBId,
        toActiveMatchSummary(activeMatch, activeMatch.participantBId),
      );
    }

    return map;
  }
}
