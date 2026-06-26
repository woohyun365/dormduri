import { Injectable } from '@nestjs/common';
import { toDateOnlyString } from '@repo/shared/date';
import type {
  HomeDashboardLastSeasonViewerFinalResult,
  HomeDashboardSeasonHistorySummary,
} from '@repo/shared/home';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Campus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { formatKstDate } from '../../platform/time/kst-date.js';
import { buildRegisteredParticipantWhere } from './home-dashboard-counts.query.js';

const seasonHistorySeasonSelect = {
  id: true,
  name: true,
  preparationStartDate: true,
  matchingStartDate: true,
  seasonEndDate: true,
  createdAt: true,
} satisfies Prisma.SeasonSelect;

interface GetSeasonHistorySummaryInput {
  campusCode: Campus;
  userId: string;
  now: Date;
  campusOperated: boolean;
}

@Injectable()
export class HomeDashboardHistoryQuery {
  constructor(private readonly prisma: PrismaService) {}

  async getSeasonHistorySummary(
    input: GetSeasonHistorySummaryInput,
  ): Promise<HomeDashboardSeasonHistorySummary> {
    if (!input.campusOperated) {
      return { lastSeason: null };
    }

    const today = formatKstDate(input.now);
    const seasons = await this.prisma.season.findMany({
      where: { campusCode: input.campusCode },
      orderBy: [{ seasonEndDate: 'desc' }, { matchingStartDate: 'desc' }, { createdAt: 'desc' }],
      select: seasonHistorySeasonSelect,
    });
    const lastSeason = seasons.find((season) => toDateOnlyString(season.seasonEndDate) < today);

    if (!lastSeason) {
      return { lastSeason: null };
    }

    const viewerHistoryWhere = buildViewerHistoryWhere(lastSeason.id, input.userId);
    const [
      totalParticipants,
      totalMatchSuccess,
      matchedPairRows,
      operatedDormitoryCount,
      viewerRegistrationCount,
      viewerSentRequestCount,
      viewerReceivedRequestCount,
      viewerConversationCount,
      viewerMatchedSuccessCount,
      viewerUnmatchedAfterSuccessCount,
      viewerLatestMatchRow,
    ] = await Promise.all([
      this.prisma.seasonParticipant.count({
        where: buildRegisteredParticipantWhere(lastSeason.id),
      }),
      this.prisma.seasonMatchHistoryEntry.count({
        where: buildSuccessfulHistoryWhere(lastSeason.id),
      }),
      this.prisma.seasonMatchHistoryEntry.groupBy({
        by: ['pairKey'],
        where: buildSuccessfulHistoryWhere(lastSeason.id),
      }),
      this.prisma.seasonDormitoryOperation.count({
        where: { seasonId: lastSeason.id, isOperated: true },
      }),
      this.prisma.seasonParticipant.count({
        where: {
          ...buildRegisteredParticipantWhere(lastSeason.id),
          userId: input.userId,
        },
        take: 1,
      }),
      this.prisma.seasonMatchHistoryEntry.count({
        where: {
          ...viewerHistoryWhere,
          entryType: 'REQUEST',
          viewerRequested: true,
        },
      }),
      this.prisma.seasonMatchHistoryEntry.count({
        where: {
          ...viewerHistoryWhere,
          entryType: 'REQUEST',
          viewerRequested: false,
        },
      }),
      this.prisma.seasonMatchHistoryEntry.count({
        where: {
          ...viewerHistoryWhere,
          entryType: 'MATCH',
        },
      }),
      this.prisma.seasonMatchHistoryEntry.count({
        where: {
          ...viewerHistoryWhere,
          entryType: 'MATCH',
          entryResult: 'MATCHED_SUCCESS',
        },
        take: 1,
      }),
      this.prisma.seasonMatchHistoryEntry.count({
        where: {
          ...viewerHistoryWhere,
          entryType: 'MATCH',
          entryResult: 'UNMATCHED_AFTER_SUCCESS',
        },
        take: 1,
      }),
      this.prisma.seasonMatchHistoryEntry.findFirst({
        where: {
          ...viewerHistoryWhere,
          entryType: 'MATCH',
          entryResult: { in: ['MATCHED_SUCCESS', 'UNMATCHED_AFTER_SUCCESS'] },
        },
        orderBy: [{ matchedAt: 'desc' }, { finalizedAt: 'desc' }],
        select: {
          counterpartNicknameSnapshot: true,
          counterpartRedactedAt: true,
        },
      }),
    ]);

    const viewerHadRegistration = viewerRegistrationCount > 0;
    const viewerHadMatchSuccess = viewerMatchedSuccessCount > 0;

    return {
      lastSeason: {
        id: lastSeason.id,
        name: lastSeason.name,
        totalParticipants,
        totalMatchSuccess,
        viewerHadRegistration,
        viewerHadMatchSuccess,
        viewerActivity: {
          sentRequestCount: viewerSentRequestCount,
          receivedRequestCount: viewerReceivedRequestCount,
          conversationCount: viewerConversationCount,
          finalResult: resolveViewerFinalResult({
            viewerHadRegistration,
            viewerHadMatchSuccess,
            viewerHadUnmatchedAfterSuccess: viewerUnmatchedAfterSuccessCount > 0,
          }),
          matchedPartnerNickname:
            viewerLatestMatchRow?.counterpartRedactedAt === null
              ? viewerLatestMatchRow.counterpartNicknameSnapshot
              : null,
        },
        aggregate: {
          matchedPairCount: matchedPairRows.length,
          operatedDormitoryCount,
        },
      },
    };
  }
}

function buildViewerHistoryWhere(
  seasonId: string,
  userId: string,
): Prisma.SeasonMatchHistoryEntryWhereInput {
  return {
    seasonId,
    viewerRedactedAt: null,
    viewerParticipant: {
      userId,
      user: { deletedAt: null },
    },
  };
}

function resolveViewerFinalResult(input: {
  viewerHadRegistration: boolean;
  viewerHadMatchSuccess: boolean;
  viewerHadUnmatchedAfterSuccess: boolean;
}): HomeDashboardLastSeasonViewerFinalResult {
  if (!input.viewerHadRegistration) {
    return 'NOT_PARTICIPATED';
  }
  if (input.viewerHadMatchSuccess) {
    return 'MATCHED';
  }
  if (input.viewerHadUnmatchedAfterSuccess) {
    return 'UNMATCHED_AFTER_SUCCESS';
  }
  return 'NO_MATCH';
}

function buildSuccessfulHistoryWhere(seasonId: string): Prisma.SeasonMatchHistoryEntryWhereInput {
  return {
    seasonId,
    entryResult: 'MATCHED_SUCCESS',
    viewerRedactedAt: null,
    viewerParticipant: {
      user: { deletedAt: null },
    },
  };
}
