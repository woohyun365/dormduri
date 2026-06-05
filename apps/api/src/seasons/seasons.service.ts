import { Injectable } from '@nestjs/common';
import type { Campus } from '../generated/prisma/enums.js';
import type { CurrentSeasonResponse } from '@repo/shared/season-contract';
import { CurrentSeasonContextQuery } from './runtime/current-season-context.query.js';
import { DormitoryMatchWindowQuery } from './runtime/dormitory-match-window.query.js';
import type { CurrentSeasonContext } from './runtime/season-runtime.types.js';

@Injectable()
export class SeasonsService {
  constructor(
    private readonly currentSeasonContextQuery: CurrentSeasonContextQuery,
    private readonly dormitoryMatchWindowQuery: DormitoryMatchWindowQuery,
  ) {}

  async getCurrentSeason(campusCode: Campus, now?: Date): Promise<CurrentSeasonResponse | null> {
    return this.currentSeasonContextQuery.execute(campusCode, now);
  }

  async getCurrentSeasonContext(
    campusCode: Campus,
    now?: Date,
  ): Promise<CurrentSeasonContext | null> {
    return this.currentSeasonContextQuery.execute(campusCode, now);
  }

  async getCurrentSeasonState(campusCode: Campus, now?: Date) {
    return (await this.getCurrentSeasonContext(campusCode, now))?.state ?? null;
  }

  async getCurrentDormitoryMatchWindow(campusCode: Campus, dormitoryId: string, now?: Date) {
    return this.dormitoryMatchWindowQuery.execute(campusCode, dormitoryId, now);
  }

  async isCurrentSeasonOpen(campusCode: Campus, now?: Date) {
    return (await this.getCurrentSeasonState(campusCode, now)) === 'SEASON_OPEN';
  }

  async isCurrentSeasonMatching(campusCode: Campus, now?: Date) {
    return (await this.getCurrentSeasonState(campusCode, now)) === 'SEASON_MATCHING';
  }
}
