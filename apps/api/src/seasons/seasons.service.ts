import { Injectable } from '@nestjs/common';
import type { Campus } from '../generated/prisma/enums.js';
import type { SeasonContextCache } from './cache/season-context-cache.js';
import { CurrentSeasonContextQuery } from './runtime/current-season-context.query.js';
import { DormitoryMatchWindowQuery } from './runtime/dormitory-match-window.query.js';
import type { CurrentSeasonContext, SeasonContextPort } from './ports/season-context.port.js';
import type { CurrentSeasonResponse } from '@repo/shared/season/runtime';

@Injectable()
export class SeasonsService implements SeasonContextPort {
  constructor(
    private readonly currentSeasonContextQuery: CurrentSeasonContextQuery,
    private readonly dormitoryMatchWindowQuery: DormitoryMatchWindowQuery,
  ) {}

  async getCurrentSeason(
    campusCode: Campus,
    now?: Date,
    cache?: SeasonContextCache,
  ): Promise<CurrentSeasonResponse | null> {
    return this.currentSeasonContextQuery.execute(campusCode, now, cache);
  }

  async getCurrentSeasonContext(
    campusCode: Campus,
    now?: Date,
    cache?: SeasonContextCache,
  ): Promise<CurrentSeasonContext | null> {
    return this.currentSeasonContextQuery.execute(campusCode, now, cache);
  }

  async getCurrentSeasonState(campusCode: Campus, now?: Date, cache?: SeasonContextCache) {
    return (await this.getCurrentSeasonContext(campusCode, now, cache))?.state ?? null;
  }

  async getCurrentDormitoryMatchWindow(
    campusCode: Campus,
    dormitoryId: string,
    now?: Date,
    cache?: SeasonContextCache,
  ) {
    return this.dormitoryMatchWindowQuery.execute(campusCode, dormitoryId, now, cache);
  }

  async isCurrentSeasonOpen(campusCode: Campus, now?: Date, cache?: SeasonContextCache) {
    return (await this.getCurrentSeasonState(campusCode, now, cache)) === 'SEASON_OPEN';
  }

  async isCurrentSeasonMatching(campusCode: Campus, now?: Date, cache?: SeasonContextCache) {
    return (await this.getCurrentSeasonState(campusCode, now, cache)) === 'SEASON_MATCHING';
  }
}
