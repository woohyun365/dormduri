import { Injectable } from '@nestjs/common';
import { toDateOnlyString } from '@repo/shared/date';
import type { HomeDashboardSeasonHistorySummary } from '@repo/shared/home';
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

    const [totalParticipants, totalMatchSuccess, viewerRegistrationCount, viewerMatchCount] =
      await Promise.all([
        this.prisma.seasonParticipant.count({
          where: buildRegisteredParticipantWhere(lastSeason.id),
        }),
        this.prisma.seasonMatchHistoryEntry.count({
          where: buildSuccessfulHistoryWhere(lastSeason.id),
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
            ...buildSuccessfulHistoryWhere(lastSeason.id),
            viewerParticipant: {
              userId: input.userId,
              user: { deletedAt: null },
            },
          },
          take: 1,
        }),
      ]);

    return {
      lastSeason: {
        id: lastSeason.id,
        name: lastSeason.name,
        totalParticipants,
        totalMatchSuccess,
        viewerHadRegistration: viewerRegistrationCount > 0,
        viewerHadMatchSuccess: viewerMatchCount > 0,
      },
    };
  }
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
