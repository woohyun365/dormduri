import type { SeasonState } from '@repo/shared/season/runtime';

export interface Season {
  name: string;
  roomSelectionDate: string; // 호실선택일 (자동화 앵커)
}

/** 호실선택일 기준 오프셋 (주 단위) */
const OPEN_OFFSET_WEEKS = 5;
const MATCH_OFFSET_WEEKS = 4;

/** ISO 날짜 문자열 → KST 자정 timestamp */
function toKstMidnight(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00+09:00').getTime();
}

/** ISO 날짜 문자열 → KST 23:59:59 timestamp */
function toKstEndOfDay(dateStr: string): number {
  return new Date(dateStr + 'T23:59:59+09:00').getTime();
}

/** 호실선택일에서 N주 전 날짜 계산 (순수 날짜 산술, 시간대 무관) */
function weeksBeforeDate(dateStr: string, weeks: number): string {
  const parts = dateStr.split('-').map(Number);
  const date = new Date(parts[0]!, parts[1]! - 1, parts[2]! - weeks * 7);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 시즌 일정 자동 계산 (roomSelectionDate 없으면 fallback) */
export function calcSeasonDates(roomSelectionDate: string) {
  const fallback = '2099-12-31';
  const date = roomSelectionDate || fallback;
  return {
    openStart: weeksBeforeDate(date, OPEN_OFFSET_WEEKS),
    matchStart: weeksBeforeDate(date, MATCH_OFFSET_WEEKS),
    matchEnd: date,
  };
}

/** 시즌 상태 판정: OFF_SEASON / SEASON_OPEN / SEASON_MATCHING */
export function getSeasonState(season: Season): SeasonState {
  const now = Date.now();
  const { openStart, matchStart, matchEnd } = calcSeasonDates(season.roomSelectionDate);

  const openStartTs = toKstMidnight(openStart);
  const matchStartTs = toKstMidnight(matchStart);
  const matchEndTs = toKstEndOfDay(matchEnd);

  if (now >= matchStartTs && now <= matchEndTs) return 'SEASON_MATCHING';
  if (now >= openStartTs && now < matchStartTs) return 'SEASON_OPEN';
  return 'OFF_SEASON';
}

/** 시즌 매칭 종료까지 남은 일수 */
export function calcDaysUntilEnd(season: Season): number {
  const now = Date.now();
  const matchEndTs = toKstEndOfDay(season.roomSelectionDate);
  return Math.max(0, Math.ceil((matchEndTs - now) / (1000 * 60 * 60 * 24)));
}

// Mock data (추후 API 연동)
// 날짜: 현재 기준 시즌 활성 상태 (호실선택일 기준 역산)
export const CURRENT_SEASON: Season = {
  name: '2026년 1학기',
  roomSelectionDate: '2026-04-30',
};
