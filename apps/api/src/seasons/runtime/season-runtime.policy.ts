import type { LocalDateString } from '@repo/shared/date';
import type { SeasonState } from '@repo/shared/season/runtime';
import { toKstEndMs, toKstStartMs } from '../../platform/time/kst-date.js';
import type { SeasonOverrideSource, SeasonWindowSource } from './season-runtime.types.js';

export function getMatchingEndDate(
  dormitoryOperations: SeasonWindowSource['dormitoryOperations'],
): LocalDateString | null {
  const dates = dormitoryOperations
    .filter((operation) => operation.isOperated)
    .map((operation) => operation.roomSelectionDate)
    .sort();

  return dates.at(-1) ?? null;
}

export function resolveSeasonSchedule(season: SeasonWindowSource) {
  const matchingEnd = getMatchingEndDate(season.dormitoryOperations) ?? season.seasonEndDate;

  return {
    preparationStart: season.preparationStartDate,
    matchingStart: season.matchingStartDate,
    matchingEnd,
    seasonEnd: season.seasonEndDate,
  };
}

export function hasActiveSeasonOverride(
  season: SeasonOverrideSource,
  now: Date,
): season is SeasonOverrideSource & { overrideState: SeasonState } {
  if (!season.overrideState) {
    return false;
  }

  const nowMs = now.getTime();
  const startedAtMs = season.overrideStartedAt
    ? new Date(season.overrideStartedAt).getTime()
    : Number.NEGATIVE_INFINITY;
  const endsAtMs = season.overrideEndsAt
    ? new Date(season.overrideEndsAt).getTime()
    : Number.POSITIVE_INFINITY;

  return nowMs >= startedAtMs && nowMs <= endsAtMs;
}

export function getEffectiveSeasonState(
  season: SeasonWindowSource & SeasonOverrideSource,
  now: Date,
): SeasonState {
  const resolvedState = hasActiveSeasonOverride(season, now)
    ? season.overrideState
    : (() => {
        const schedule = resolveSeasonSchedule(season);
        const nowMs = now.getTime();

        if (
          nowMs < toKstStartMs(schedule.preparationStart) ||
          nowMs > toKstEndMs(schedule.seasonEnd)
        ) {
          return 'OFF_SEASON' as const;
        }

        if (nowMs < toKstStartMs(schedule.matchingStart)) {
          return 'SEASON_OPEN' as const;
        }

        if (nowMs <= toKstEndMs(schedule.matchingEnd)) {
          return 'SEASON_MATCHING' as const;
        }

        return 'SEASON_POST_MATCH' as const;
      })();

  const hasOperatedDormitories = season.dormitoryOperations.some(
    (operation) => operation.isOperated,
  );
  if (
    !hasOperatedDormitories &&
    (resolvedState === 'SEASON_MATCHING' || resolvedState === 'SEASON_POST_MATCH')
  ) {
    return 'SEASON_OPEN';
  }

  return resolvedState;
}
