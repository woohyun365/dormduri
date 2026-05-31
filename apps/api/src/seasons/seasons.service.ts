import { Injectable } from '@nestjs/common';
import type { Campus } from '../generated/prisma/enums.js';
import type { CurrentSeasonResponse } from '@repo/shared/season-contract';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { getCurrentTimestamp } from '../generated/prisma/sql.js';
import {
  formatKstDate,
  hasActiveSeasonOverride,
  normalizeSeasonRuntimeRow,
  toCurrentSeasonResponse,
} from './season.utils.js';
import type { CurrentSeasonContext } from './season.types.js';

@Injectable()
export class SeasonsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentSeason(campusCode: Campus, now?: Date): Promise<CurrentSeasonResponse | null> {
    return this.getSeasonContext(campusCode, now);
  }

  async getCurrentSeasonContext(
    campusCode: Campus,
    now?: Date,
  ): Promise<CurrentSeasonContext | null> {
    return this.getSeasonContext(campusCode, now);
  }

  private async getSeasonContext(
    campusCode: Campus,
    now: Date | undefined,
  ): Promise<CurrentSeasonContext | null> {
    const referenceNow = await this.resolveReferenceTime(now);
    const campusMeta = await this.prisma.campusMaster.findUnique({
      where: { code: campusCode },
      select: { isOperated: true },
    });

    if (!campusMeta?.isOperated) {
      return null;
    }

    const seasons = await this.prisma.season.findMany({
      where: { campusCode },
      orderBy: [{ seasonEndDate: 'asc' }, { matchingStartDate: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        campusCode: true,
        name: true,
        preparationStartDate: true,
        matchingStartDate: true,
        seasonEndDate: true,
        overrideState: true,
        overrideReason: true,
        overrideStartedAt: true,
        overrideEndsAt: true,
        dormitoryOperations: {
          select: {
            dormitoryId: true,
            isOperated: true,
            roomSelectionDate: true,
          },
          orderBy: [{ roomSelectionDate: 'asc' }, { dormitoryId: 'asc' }],
        },
      },
    });

    if (seasons.length === 0) {
      return null;
    }

    const normalizedSeasons = seasons.map(normalizeSeasonRuntimeRow);
    const today = formatKstDate(referenceNow);

    const currentSeasons = normalizedSeasons.filter(
      (season) => season.preparationStartDate <= today && season.seasonEndDate >= today,
    );
    const overrideSeason = currentSeasons.find((season) =>
      hasActiveSeasonOverride(season, referenceNow),
    );

    const selectedSeason = overrideSeason ?? currentSeasons[0] ?? null;

    if (!selectedSeason) {
      return null;
    }

    return toCurrentSeasonResponse(selectedSeason, referenceNow);
  }

  async getCurrentSeasonState(campusCode: Campus, now?: Date) {
    return (await this.getCurrentSeasonContext(campusCode, now))?.state ?? null;
  }

  async getCurrentDormitoryMatchWindow(campusCode: Campus, dormitoryId: string, now?: Date) {
    const context = await this.getCurrentSeasonContext(campusCode, now);
    if (!context) {
      return null;
    }

    const dormitory = context.operatedDormitories.find((item) => item.dormitoryId === dormitoryId);
    if (!dormitory) {
      return null;
    }

    const referenceNow = await this.resolveReferenceTime(now);
    const nowDateOnly = formatKstDate(referenceNow);

    return {
      dormitoryId,
      matchingStartDate: context.schedule.matchingStart,
      matchingEndDate: dormitory.roomSelectionDate,
      canMatch:
        nowDateOnly >= context.schedule.matchingStart &&
        nowDateOnly <= dormitory.roomSelectionDate &&
        context.state !== 'OFF_SEASON' &&
        context.state !== 'SEASON_OPEN',
    };
  }

  async isCurrentSeasonOpen(campusCode: Campus, now?: Date) {
    return (await this.getCurrentSeasonState(campusCode, now)) === 'SEASON_OPEN';
  }

  async isCurrentSeasonMatching(campusCode: Campus, now?: Date) {
    return (await this.getCurrentSeasonState(campusCode, now)) === 'SEASON_MATCHING';
  }

  private async resolveReferenceTime(now?: Date) {
    if (now) {
      return now;
    }

    const [row] = await this.prisma.$queryRawTyped(getCurrentTimestamp());

    if (!row?.now) {
      return new Date();
    }

    return row.now instanceof Date ? row.now : new Date(row.now);
  }
}
