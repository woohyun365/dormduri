import type { SeasonRuntimeOverride, SeasonState } from '@repo/shared/season-contract';
import { toDateOnlyString, type LocalDateString } from '@repo/shared/date-primitives';
import type { NormalizedSeasonRuntimeRow } from './season.types.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function formatKstDate(date: Date): LocalDateString {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function endOfMonthDate(year: number, month1Based: number): LocalDateString {
  const date = new Date(Date.UTC(year, month1Based, 0));
  return date.toISOString().slice(0, 10);
}

export function subtractDays(dateStr: LocalDateString, days: number): LocalDateString {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export type SeasonWindowSource = {
  preparationStartDate: LocalDateString;
  matchingStartDate: LocalDateString;
  seasonEndDate: LocalDateString;
  dormitoryOperations: Array<{
    dormitoryId: string;
    isOperated: boolean;
    roomSelectionDate: LocalDateString;
  }>;
};

export type SeasonOverrideSource = {
  overrideState?: SeasonState | null;
  overrideStartedAt?: Date | string | null;
  overrideEndsAt?: Date | string | null;
};

function toKstStartMs(dateStr: LocalDateString): number {
  return new Date(`${dateStr}T00:00:00+09:00`).getTime();
}

function toKstEndMs(dateStr: LocalDateString): number {
  return new Date(`${dateStr}T23:59:59+09:00`).getTime();
}

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
          return 'SEASON_PREPARATION' as const;
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
    return 'SEASON_PREPARATION';
  }

  return resolvedState;
}

export function calcDaysUntilDate(dateStr: LocalDateString, now: Date): number {
  const diff = toKstEndMs(dateStr) - now.getTime();
  return Math.max(0, Math.ceil(diff / DAY_MS));
}

function getOperatedDormitories(
  dormitoryOperations: NormalizedSeasonRuntimeRow['dormitoryOperations'],
) {
  return dormitoryOperations.filter((operation) => operation.isOperated);
}

export function normalizeSeasonRuntimeRow(season: {
  id: string;
  campusCode: NormalizedSeasonRuntimeRow['campusCode'];
  name: string;
  preparationStartDate: Date | string;
  matchingStartDate: Date | string;
  seasonEndDate: Date | string;
  overrideState?: SeasonState | null;
  overrideReason?: string | null;
  overrideStartedAt?: Date | null;
  overrideEndsAt?: Date | null;
  dormitoryOperations?: Array<{
    dormitoryId: string;
    isOperated: boolean;
    roomSelectionDate: Date | string;
  }>;
}): NormalizedSeasonRuntimeRow {
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

  const override: SeasonRuntimeOverride = {
    active: hasActiveSeasonOverride(season, now),
    state: season.overrideState,
    reason: season.overrideReason,
    startedAt: season.overrideStartedAt ? season.overrideStartedAt.toISOString() : null,
    endsAt: season.overrideEndsAt ? season.overrideEndsAt.toISOString() : null,
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
    isPreparation: state === 'SEASON_PREPARATION',
    isMatching: state === 'SEASON_MATCHING',
    isPostMatch: state === 'SEASON_POST_MATCH',
    daysUntilMatchingEnd:
      state === 'SEASON_MATCHING' ? calcDaysUntilDate(schedule.matchingEnd, now) : 0,
    daysUntilSeasonEnd: state !== 'OFF_SEASON' ? calcDaysUntilDate(schedule.seasonEnd, now) : 0,
    schedule,
    override,
  };
}
