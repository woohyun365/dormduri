import type { SeasonState } from '@/types/season';

export interface Season {
  name: string;
  matchingStart: string;
  matchingEnd: string;
  roomSelectionStart: string;
  roomSelectionEnd: string;
}

/** 현재 날짜 기준 시즌 활성 여부 계산 (Asia/Seoul 시간대 고정) */
export function isSeasonActive(season: Season): boolean {
  const now = Date.now();
  const start = new Date(season.matchingStart + 'T00:00:00+09:00').getTime();
  const end = new Date(season.matchingEnd + 'T23:59:59+09:00').getTime();
  return now >= start && now <= end;
}

/** 시즌 상태 판정: ACTIVE / APPROACHING_END(D-7 이내) / OFF_SEASON */
export function getSeasonState(season: Season): SeasonState {
  const now = Date.now();
  const start = new Date(season.matchingStart + 'T00:00:00+09:00').getTime();
  const end = new Date(season.matchingEnd + 'T23:59:59+09:00').getTime();

  if (now < start || now > end) return 'OFF_SEASON';

  const daysUntilEnd = (end - now) / (1000 * 60 * 60 * 24);
  if (daysUntilEnd <= 7) return 'APPROACHING_END';

  return 'ACTIVE';
}

// Mock data (추후 API 연동)
// ISO 문자열로 저장하여 서버/클라이언트 hydration 불일치 방지
// 날짜: 현재 기준 시즌 활성 상태 (약 2개월간)
export const CURRENT_SEASON: Season = {
  name: '2026년 1학기',
  matchingStart: '2026-03-01',
  matchingEnd: '2026-04-30',
  roomSelectionStart: '2026-04-28',
  roomSelectionEnd: '2026-04-30',
};
