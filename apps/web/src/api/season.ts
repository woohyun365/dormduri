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
      const daysUntilEnd = mock.calcDaysUntilEnd(mock.CURRENT_SEASON);

      // DevPanel 시즌 오버라이드 체크
      if (typeof window !== 'undefined') {
        const override = localStorage.getItem(SEASON_OVERRIDE_KEY);
        if (
          override === 'OFF_SEASON' ||
          override === 'SEASON_OPEN' ||
          override === 'SEASON_MATCHING'
        ) {
          return {
            season: mock.CURRENT_SEASON,
            state: override,
            isOpen: override === 'SEASON_OPEN',
            isMatching: override === 'SEASON_MATCHING',
            daysUntilEnd: override === 'OFF_SEASON' ? 0 : daysUntilEnd,
          };
        }
      }

      const state = mock.getSeasonState(mock.CURRENT_SEASON);
      return {
        season: mock.CURRENT_SEASON,
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
