import { Injectable } from '@nestjs/common';
import type { Campus } from '../../generated/prisma/enums.js';
import { formatKstDate } from '../../platform/time/kst-date.js';
import type { SeasonContextCache } from '../cache/season-context-cache.js';
import {
  resolveMemoizedCurrentSeasonContext,
  resolveSeasonReferenceNow,
} from '../cache/season-context-memoizer.js';
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

  async execute(
    campusCode: Campus,
    now?: Date,
    cache?: SeasonContextCache,
  ): Promise<CurrentSeasonContext | null> {
    return (await this.resolve(campusCode, now, cache)).context;
  }

  async resolve(
    campusCode: Campus,
    now?: Date,
    cache?: SeasonContextCache,
  ): Promise<ResolvedCurrentSeasonContext> {
    const referenceNow = await resolveSeasonReferenceNow({
      cache,
      now,
      resolveReferenceNow: () => this.repository.resolveReferenceTime(now),
    });

    return resolveMemoizedCurrentSeasonContext({
      cache,
      campusCode,
      referenceNow,
      load: () => this.resolveFresh(campusCode, referenceNow),
    });
  }

  private async resolveFresh(
    campusCode: Campus,
    referenceNow: Date,
  ): Promise<ResolvedCurrentSeasonContext> {
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
