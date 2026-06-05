import { Injectable } from '@nestjs/common';
import type { Campus } from '../../generated/prisma/enums.js';
import { formatKstDate } from '../../platform/time/kst-date.js';
import { normalizeSeasonRuntimeRow, toCurrentSeasonResponse } from './current-season.mapper.js';
import { hasActiveSeasonOverride } from './season-runtime.policy.js';
import { SeasonRuntimeRepository } from './season-runtime.repository.js';
import type { CurrentSeasonContext } from './season-runtime.types.js';

export interface ResolvedCurrentSeasonContext {
  context: CurrentSeasonContext | null;
  referenceNow: Date;
}

@Injectable()
export class CurrentSeasonContextQuery {
  constructor(private readonly repository: SeasonRuntimeRepository) {}

  async execute(campusCode: Campus, now?: Date): Promise<CurrentSeasonContext | null> {
    return (await this.resolve(campusCode, now)).context;
  }

  async resolve(campusCode: Campus, now?: Date): Promise<ResolvedCurrentSeasonContext> {
    const referenceNow = await this.repository.resolveReferenceTime(now);
    const isCampusOperated = await this.repository.isCampusOperated(campusCode);

    if (!isCampusOperated) {
      return { context: null, referenceNow };
    }

    const seasons = await this.repository.findSeasonRuntimeRows(campusCode);
    if (seasons.length === 0) {
      return { context: null, referenceNow };
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

    return {
      context: selectedSeason ? toCurrentSeasonResponse(selectedSeason, referenceNow) : null,
      referenceNow,
    };
  }
}
