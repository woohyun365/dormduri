// TODO: BE API 연동 시 실제 endpoint로 교체

import type { Season } from '@/constants/season';
import type { SeasonState } from '@/types/season';

async function getMockData() {
  if (process.env.NODE_ENV === 'development') {
    const { CURRENT_SEASON, getSeasonState, calcDaysUntilEnd } = await import('@/constants/season');
    return { CURRENT_SEASON, getSeasonState, calcDaysUntilEnd };
  }
  return null;
}

const SEASON_OVERRIDE_KEY = 'devpanel-season-override';
const SEASON_DATE_OVERRIDE_KEY = 'devpanel-season-date-override';

function getDateOverriddenSeason(season: Season): Season {
  if (typeof window === 'undefined') return season;
  const override = localStorage.getItem(SEASON_DATE_OVERRIDE_KEY);
  if (!override || override === 'auto') return season;

  const now = new Date();
  if (override === 'next-semester') {
    // 6개월 후 호실 선택일
    const future = new Date(now.getFullYear(), now.getMonth() + 6, 15);
    return {
      name: `${future.getFullYear()}년 ${future.getMonth() + 1 >= 7 ? '2' : '1'}학기`,
      roomSelectionDate: `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`,
    };
  }
  if (override === 'past') {
    // 3개월 전 호실 선택일
    const past = new Date(now.getFullYear(), now.getMonth() - 3, 15);
    return {
      name: `${past.getFullYear()}년 ${past.getMonth() + 1 >= 7 ? '2' : '1'}학기`,
      roomSelectionDate: `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`,
    };
  }
  // ISO 날짜 문자열 (YYYY-MM-DD) — SeasonDevTool D-Day 슬라이더
  if (/^\d{4}-\d{2}-\d{2}$/.test(override)) {
    return { ...season, roomSelectionDate: override };
  }
  return season;
}

export interface SeasonApiResult {
  season: Season;
  state: SeasonState;
  isOpen: boolean;
  isMatching: boolean;
  daysUntilEnd: number;
}

export const seasonApi = {
  getCurrentSeason: async (): Promise<SeasonApiResult | null> => {
    const mock = await getMockData();
    if (mock) {
      const season = getDateOverriddenSeason(mock.CURRENT_SEASON);
      const daysUntilEnd = mock.calcDaysUntilEnd(season);

      // DevPanel 시즌 오버라이드 체크
      if (typeof window !== 'undefined') {
        const override = localStorage.getItem(SEASON_OVERRIDE_KEY);
        if (
          override === 'OFF_SEASON' ||
          override === 'SEASON_OPEN' ||
          override === 'SEASON_MATCHING'
        ) {
          return {
            season,
            state: override,
            isOpen: override === 'SEASON_OPEN',
            isMatching: override === 'SEASON_MATCHING',
            daysUntilEnd: override === 'OFF_SEASON' ? 0 : daysUntilEnd,
          };
        }
      }

      const state = mock.getSeasonState(season);
      return {
        season,
        state,
        isOpen: state === 'SEASON_OPEN',
        isMatching: state === 'SEASON_MATCHING',
        daysUntilEnd,
      };
    }
    // TODO: GET /api/seasons/current
    return null;
  },
};
