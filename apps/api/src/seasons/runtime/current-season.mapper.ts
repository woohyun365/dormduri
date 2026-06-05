import type { SeasonRuntimeOverride } from '@repo/shared/season-contract';
import { toDateOnlyString } from '@repo/shared/date-primitives';
import { calcDaysUntilDate } from '../../platform/time/kst-date.js';
import {
  getEffectiveSeasonState,
  hasActiveSeasonOverride,
  resolveSeasonSchedule,
} from './season-runtime.policy.js';
import type { NormalizedSeasonRuntimeRow, SeasonRuntimeRowInput } from './season-runtime.types.js';

function getOperatedDormitories(
  dormitoryOperations: NormalizedSeasonRuntimeRow['dormitoryOperations'],
) {
  return dormitoryOperations.filter((operation) => operation.isOperated);
}

export function normalizeSeasonRuntimeRow(
  season: SeasonRuntimeRowInput,
): NormalizedSeasonRuntimeRow {
  return {
    id: season.id,
    campusCode: season.campusCode,
    name: season.name,
    preparationStartDate: toDateOnlyString(season.preparationStartDate),
    matchingStartDate: toDateOnlyString(season.matchingStartDate),
    seasonEndDate: toDateOnlyString(season.seasonEndDate),
    overrideState: season.overrideState ?? null,
    overrideReason: season.overrideReason ?? null,
    overrideStartedAt: season.overrideStartedAt ?? null,
    overrideEndsAt: season.overrideEndsAt ?? null,
    dormitoryOperations: (season.dormitoryOperations ?? []).map((operation) => ({
      dormitoryId: operation.dormitoryId,
      isOperated: operation.isOperated,
      roomSelectionDate: toDateOnlyString(operation.roomSelectionDate),
    })),
  };
}

export function toCurrentSeasonResponse(season: NormalizedSeasonRuntimeRow, now: Date) {
  const schedule = resolveSeasonSchedule(season);
  const state = getEffectiveSeasonState(season, now);
  const operatedDormitories = getOperatedDormitories(season.dormitoryOperations);
  const hasActiveOverride = hasActiveSeasonOverride(season, now);

  const override: SeasonRuntimeOverride = {
    active: hasActiveOverride,
    state: hasActiveOverride ? season.overrideState : null,
    reason: hasActiveOverride ? season.overrideReason : null,
    startedAt:
      hasActiveOverride && season.overrideStartedAt ? season.overrideStartedAt.toISOString() : null,
    endsAt: hasActiveOverride && season.overrideEndsAt ? season.overrideEndsAt.toISOString() : null,
  };

  return {
    campusCode: season.campusCode,
    season: {
      id: season.id,
      name: season.name,
      preparationStartDate: season.preparationStartDate,
      matchingStartDate: season.matchingStartDate,
      seasonEndDate: season.seasonEndDate,
    },
    operatedDormitories,
    state,
    isActive: state !== 'OFF_SEASON',
    isOpen: state === 'SEASON_OPEN',
    isMatching: state === 'SEASON_MATCHING',
    isPostMatch: state === 'SEASON_POST_MATCH',
    daysUntilMatchingEnd:
      state === 'SEASON_MATCHING' ? calcDaysUntilDate(schedule.matchingEnd, now) : 0,
    daysUntilSeasonEnd: state !== 'OFF_SEASON' ? calcDaysUntilDate(schedule.seasonEnd, now) : 0,
    schedule,
    override,
  };
}
