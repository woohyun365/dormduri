import { Injectable } from '@nestjs/common';
import { toDateOnlyString } from '@repo/shared/date';
import type { HomeDashboardNextSeasonPreview } from '@repo/shared/home';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Campus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { formatKstDate } from '../../platform/time/kst-date.js';

const nextSeasonSelect = {
  id: true,
  name: true,
  preparationStartDate: true,
  matchingStartDate: true,
  seasonEndDate: true,
  dormitoryOperations: {
    where: { isOperated: true },
    orderBy: [{ roomSelectionDate: 'asc' }, { dormitoryId: 'asc' }],
    select: {
      dormitoryId: true,
      isOperated: true,
      roomSelectionDate: true,
    },
  },
  createdAt: true,
} satisfies Prisma.SeasonSelect;

interface GetNextSeasonPreviewInput {
  campusCode: Campus;
  now: Date;
  campusOperated: boolean;
}

@Injectable()
export class HomeDashboardNextSeasonQuery {
  constructor(private readonly prisma: PrismaService) {}

  async getNextSeasonPreview(
    input: GetNextSeasonPreviewInput,
  ): Promise<HomeDashboardNextSeasonPreview> {
    if (!input.campusOperated) {
      return null;
    }

    const today = formatKstDate(input.now);
    const seasons = await this.prisma.season.findMany({
      where: { campusCode: input.campusCode },
      orderBy: [
        { preparationStartDate: 'asc' },
        { matchingStartDate: 'asc' },
        { createdAt: 'asc' },
      ],
      select: nextSeasonSelect,
    });
    const nextSeason = seasons.find(
      (season) => toDateOnlyString(season.preparationStartDate) > today,
    );

    if (!nextSeason) {
      return null;
    }

    return {
      id: nextSeason.id,
      name: nextSeason.name,
      preparationStartDate: toDateOnlyString(nextSeason.preparationStartDate),
      matchingStartDate: toDateOnlyString(nextSeason.matchingStartDate),
      seasonEndDate: toDateOnlyString(nextSeason.seasonEndDate),
      visibleToUser: true,
      operatedDormitories: nextSeason.dormitoryOperations.map((operation) => ({
        dormitoryId: operation.dormitoryId,
        isOperated: operation.isOperated,
        roomSelectionDate: toDateOnlyString(operation.roomSelectionDate),
      })),
    };
  }
}
