// TODO: BE API 연동 시 실제 endpoint로 교체

import type { Season } from '@/constants/season';
import type { SeasonState } from '@/types/season';

async function getMockData() {
  if (process.env.NODE_ENV === 'development') {
    const { CURRENT_SEASON, isSeasonActive, getSeasonState } = await import('@/constants/season');
    return { CURRENT_SEASON, isSeasonActive, getSeasonState };
  }
  return null;
}

const SEASON_OVERRIDE_KEY = 'devpanel-season-override';

export const seasonApi = {
  getCurrentSeason: async (): Promise<{
    season: Season;
    state: SeasonState;
    isActive: boolean;
  } | null> => {
    const mock = await getMockData();
    if (mock) {
      // DevPanel 시즌 오버라이드 체크
      if (typeof window !== 'undefined') {
        const override = localStorage.getItem(SEASON_OVERRIDE_KEY);
        if (override === 'ACTIVE' || override === 'APPROACHING_END' || override === 'OFF_SEASON') {
          return {
            season: mock.CURRENT_SEASON,
            state: override,
            isActive: override !== 'OFF_SEASON',
          };
        }
      }

      return {
        season: mock.CURRENT_SEASON,
        state: mock.getSeasonState(mock.CURRENT_SEASON),
        isActive: mock.isSeasonActive(mock.CURRENT_SEASON),
      };
    }
    // TODO: GET /api/seasons/current
    return null;
  },
};
