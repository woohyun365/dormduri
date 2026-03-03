export interface Season {
  name: string;
  matchingStart: string;
  matchingEnd: string;
  roomSelectionStart: string;
  roomSelectionEnd: string;
}

/** 현재 날짜 기준 시즌 활성 여부 계산 */
export function isSeasonActive(season: Season): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(season.matchingStart + 'T00:00:00');
  const end = new Date(season.matchingEnd + 'T23:59:59');
  return today >= start && today <= end;
}

// Mock data (추후 API 연동)
// ISO 문자열로 저장하여 서버/클라이언트 hydration 불일치 방지
export const CURRENT_SEASON: Season = {
  name: '2026년 1학기',
  matchingStart: '2026-01-20',
  matchingEnd: '2026-02-12',
  roomSelectionStart: '2026-02-11',
  roomSelectionEnd: '2026-02-12',
};
