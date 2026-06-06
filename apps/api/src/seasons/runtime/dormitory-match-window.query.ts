import { Injectable } from '@nestjs/common';
import type { Campus } from '../../generated/prisma/enums.js';
import { formatKstDate } from '../../platform/time/kst-date.js';
import type { SeasonContextCache } from '../cache/season-context-cache.js';
import { CurrentSeasonContextQuery } from './current-season-context.query.js';

@Injectable()
export class DormitoryMatchWindowQuery {
  constructor(private readonly currentSeasonContextQuery: CurrentSeasonContextQuery) {}

  async execute(campusCode: Campus, dormitoryId: string, now?: Date, cache?: SeasonContextCache) {
    const { context, referenceNow } = await this.currentSeasonContextQuery.resolve(
      campusCode,
      now,
      cache,
    );
    if (!context) {
      return null;
    }

    const dormitory = context.operatedDormitories.find((item) => item.dormitoryId === dormitoryId);
    if (!dormitory) {
      return null;
    }

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
}
