import type { RoommateProfile, UserProfile } from '@/types/profile';
import type { BuildingStats, PastSeasonResult } from '@/main/types/home';

async function getMockData() {
  if (process.env.NODE_ENV === 'development') {
    const { getMockHomeService } = await import('@/__fixtures__/mock-home-service');
    return { homeService: getMockHomeService() };
  }
  return null;
}

export const homeApi = {
  getBuildingStats: async (
    user: UserProfile,
    profiles: Omit<RoommateProfile, 'matchScore'>[],
  ): Promise<BuildingStats> => {
    const mock = await getMockData();
    if (mock) {
      return mock.homeService.getBuildingStats(user, profiles);
    }
    return {
      totalParticipants: 0,
      assignedParticipants: 0,
      buildingMatchable: 0,
      buildingTotal: 0,
      todayNewTotal: 0,
      todayNewBuilding: 0,
      totalMatchSuccess: 0,
      buildingMatchSuccess: 0,
      popularCondition: '-',
    };
  },

  getPastSeasonResult: async (): Promise<PastSeasonResult | undefined> => {
    const mock = await getMockData();
    return mock?.homeService.getPastSeasonResult();
  },

  getNextSeasonRegisteredOverride: async (): Promise<boolean | null> => {
    const mock = await getMockData();
    return mock?.homeService.getNextSeasonRegisteredOverride() ?? null;
  },
};
