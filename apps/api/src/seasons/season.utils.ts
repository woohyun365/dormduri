import type { CurrentSeasonResponse, SeasonState } from '@repo/shared/season-contract';
import { toDateOnlyString, type LocalDateString } from '@repo/shared/date-primitives';
import type { NormalizedSeasonRuntimeRow } from './season.types.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function formatKstDate(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function weeksBeforeDate(dateStr: string, weeks: number): string {
  const parts = dateStr.split('-').map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - weeks * 7);
  return date.toISOString().slice(0, 10);
}

export function calcSeasonSchedule(roomSelectionDate: string) {
  return {
    openStart: weeksBeforeDate(roomSelectionDate, 5),
    matchStart: weeksBeforeDate(roomSelectionDate, 4),
    matchEnd: roomSelectionDate,
  };
}

function toKstStartMs(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00+09:00`).getTime();
}

function toKstEndMs(dateStr: string): number {
  return new Date(`${dateStr}T23:59:59+09:00`).getTime();
}

export function getSeasonState(roomSelectionDate: string, now: Date): SeasonState {
  const schedule = calcSeasonSchedule(roomSelectionDate);
  const nowMs = now.getTime();

  if (nowMs >= toKstStartMs(schedule.matchStart) && nowMs <= toKstEndMs(schedule.matchEnd)) {
    return 'SEASON_MATCHING';
  }

  if (nowMs >= toKstStartMs(schedule.openStart) && nowMs < toKstStartMs(schedule.matchStart)) {
    return 'SEASON_OPEN';
  }

  return 'OFF_SEASON';
}

export type SeasonScheduleSource = {
  roomSelectionDate: LocalDateString;
  openStartDate?: LocalDateString | null;
  matchStartDate?: LocalDateString | null;
  matchEndDate?: LocalDateString | null;
};

export type SeasonOverrideSource = {
  overrideState?: SeasonState | null;
  overrideStartedAt?: Date | string | null;
  overrideEndsAt?: Date | string | null;
};

export function resolveSeasonSchedule(season: SeasonScheduleSource) {
  const fallback = calcSeasonSchedule(season.roomSelectionDate);

  return {
    roomSelectionDate: season.roomSelectionDate,
    openStart: season.openStartDate ?? fallback.openStart,
    matchStart: season.matchStartDate ?? fallback.matchStart,
    matchEnd: season.matchEndDate ?? fallback.matchEnd,
  };
}

export function normalizeSeasonRuntimeRow(season: {
  id: string;
  name: string;
  roomSelectionDate: Date | string;
  openStartDate?: Date | string | null;
  matchStartDate?: Date | string | null;
  matchEndDate?: Date | string | null;
  overrideState?: SeasonState | null;
  overrideReason?: string | null;
  overrideStartedAt?: Date | null;
  overrideEndsAt?: Date | null;
}): NormalizedSeasonRuntimeRow {
  return {
    id: season.id,
    name: season.name,
    roomSelectionDate: toDateOnlyString(season.roomSelectionDate),
    openStartDate: season.openStartDate ? toDateOnlyString(season.openStartDate) : null,
    matchStartDate: season.matchStartDate ? toDateOnlyString(season.matchStartDate) : null,
    matchEndDate: season.matchEndDate ? toDateOnlyString(season.matchEndDate) : null,
    overrideState: season.overrideState ?? null,
    overrideReason: season.overrideReason ?? null,
    overrideStartedAt: season.overrideStartedAt ?? null,
    overrideEndsAt: season.overrideEndsAt ?? null,
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
  season: SeasonScheduleSource & SeasonOverrideSource,
  now: Date,
): SeasonState {
  if (hasActiveSeasonOverride(season, now)) {
    return season.overrideState;
  }

  const schedule = resolveSeasonSchedule(season);
  const nowMs = now.getTime();

  if (nowMs >= toKstStartMs(schedule.matchStart) && nowMs <= toKstEndMs(schedule.matchEnd)) {
    return 'SEASON_MATCHING';
  }

  if (nowMs >= toKstStartMs(schedule.openStart) && nowMs < toKstStartMs(schedule.matchStart)) {
    return 'SEASON_OPEN';
  }

  return 'OFF_SEASON';
}

export function calcDaysUntilEnd(roomSelectionDate: string, now: Date): number {
  const diff = toKstEndMs(roomSelectionDate) - now.getTime();
  return Math.max(0, Math.ceil(diff / DAY_MS));
}

export function toCurrentSeasonResponse(
  season: NormalizedSeasonRuntimeRow,
  now: Date,
  nextSeason: {
    id: string;
    name: string;
    roomSelectionDate: LocalDateString;
  } | null = null,
): CurrentSeasonResponse {
  const schedule = resolveSeasonSchedule(season);
  const roomSelectionDate = schedule.roomSelectionDate;
  const state = getEffectiveSeasonState(season, now);

  return {
    season: {
      id: season.id,
      name: season.name,
      roomSelectionDate,
    },
    nextSeason: nextSeason
      ? {
          id: nextSeason.id,
          name: nextSeason.name,
          roomSelectionDate: nextSeason.roomSelectionDate,
        }
      : null,
    state,
    isActive: state !== 'OFF_SEASON',
    isOpen: state === 'SEASON_OPEN',
    isMatching: state === 'SEASON_MATCHING',
    daysUntilEnd: state === 'SEASON_MATCHING' ? calcDaysUntilEnd(schedule.matchEnd, now) : 0,
    schedule,
  };
}
