import { Injectable } from '@nestjs/common';
import type { CurrentSeasonResponse } from '@repo/shared/season-contract';
import { toIsoDateTimeString } from '@repo/shared/date-primitives';
import { PrismaService } from '../common/prisma/prisma.service.js';
import {
  formatKstDate,
  hasActiveSeasonOverride,
  normalizeSeasonRuntimeRow,
  resolveSeasonSchedule,
  toCurrentSeasonResponse,
} from './season.utils.js';
import type { CurrentSeasonContext } from './season.types.js';

@Injectable()
export class SeasonsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentSeason(now?: Date): Promise<CurrentSeasonResponse | null> {
    const context = await this.getCurrentSeasonContext(now);
    if (!context) {
      return null;
    }

    return {
      season: context.season,
      nextSeason: context.nextSeason,
      state: context.state,
      isActive: context.isActive,
      isOpen: context.isOpen,
      isMatching: context.isMatching,
      daysUntilEnd: context.daysUntilEnd,
      schedule: context.schedule,
    };
  }

  async getCurrentSeasonContext(now?: Date): Promise<CurrentSeasonContext | null> {
    const referenceNow = await this.resolveReferenceTime(now);
    const seasons = await this.prisma.season.findMany({
      orderBy: [{ matchEndDate: 'asc' }, { roomSelectionDate: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        roomSelectionDate: true,
        openStartDate: true,
        matchStartDate: true,
        matchEndDate: true,
        overrideState: true,
        overrideReason: true,
        overrideStartedAt: true,
        overrideEndsAt: true,
      },
    });

    if (seasons.length === 0) {
      return null;
    }

    const normalizedSeasons = seasons.map(normalizeSeasonRuntimeRow);
    const today = formatKstDate(referenceNow);
    const overrideSeason = normalizedSeasons.find((season) =>
      hasActiveSeasonOverride(season, referenceNow),
    );
    const currentOrUpcoming = normalizedSeasons.find(
      (season) => resolveSeasonSchedule(season).matchEnd >= today,
    );
    const upcomingSeasons = normalizedSeasons.filter(
      (season) => resolveSeasonSchedule(season).matchEnd >= today,
    );
    const selectedSeason = overrideSeason ?? currentOrUpcoming ?? normalizedSeasons.at(-1) ?? null;

    if (!selectedSeason) {
      return null;
    }

    const selectedSchedule = resolveSeasonSchedule(selectedSeason);
    const currentResponse = toCurrentSeasonResponse(selectedSeason, referenceNow);
    const nextSeason =
      selectedSchedule.openStart > today
        ? selectedSeason
        : (upcomingSeasons.find((season) => season.id !== selectedSeason.id) ?? null);

    const overrideActive = hasActiveSeasonOverride(selectedSeason, referenceNow);

    return {
      ...currentResponse,
      nextSeason: nextSeason
        ? {
            id: nextSeason.id,
            name: nextSeason.name,
            roomSelectionDate: resolveSeasonSchedule(nextSeason).roomSelectionDate,
          }
        : null,
      override: {
        active: overrideActive,
        state: selectedSeason.overrideState ?? null,
        reason: selectedSeason.overrideReason ?? null,
        startedAt: selectedSeason.overrideStartedAt
          ? toIsoDateTimeString(selectedSeason.overrideStartedAt)
          : null,
        endsAt: selectedSeason.overrideEndsAt
          ? toIsoDateTimeString(selectedSeason.overrideEndsAt)
          : null,
      },
    };
  }

  async getCurrentSeasonState(now?: Date) {
    return (await this.getCurrentSeasonContext(now))?.state ?? null;
  }

  async isCurrentSeasonOpen(now?: Date) {
    return (await this.getCurrentSeasonState(now)) === 'SEASON_OPEN';
  }

  async isCurrentSeasonMatching(now?: Date) {
    return (await this.getCurrentSeasonState(now)) === 'SEASON_MATCHING';
  }

  private async resolveReferenceTime(now?: Date) {
    if (now) {
      return now;
    }

    const [row] = await this.prisma.$queryRawUnsafe<{ now: Date }[]>(`
      SELECT CURRENT_TIMESTAMP AS "now"
    `);

    if (!row?.now) {
      return new Date();
    }

    return row.now instanceof Date ? row.now : new Date(row.now);
  }
}
