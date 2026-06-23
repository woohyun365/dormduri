import { homeDashboardResponseSchema, type HomeDashboardResponse } from '@repo/shared/home';
import type { RoommateProfile, UserProfile } from '@/types/profile';
import type { BuildingStats, PastSeasonResult } from '@/main/types/home';
import type { PastSeasonData } from '@/types/match';

async function getMockData() {
  if (process.env.NODE_ENV === 'development') {
    const { getMockHomeService } = await import('@/__fixtures__/mock-home-service');
    return { homeService: getMockHomeService() };
  }
  return null;
}

export class HomeDashboardFetchError extends Error {
  constructor(
    public readonly code: 'HOME_DASHBOARD_UPSTREAM_UNAVAILABLE' | 'HOME_DASHBOARD_UPSTREAM_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'HomeDashboardFetchError';
  }
}

async function readHomeDashboardJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new HomeDashboardFetchError(
      'HOME_DASHBOARD_UPSTREAM_INVALID',
      'Home dashboard response is not JSON.',
    );
  }

  try {
    return await response.json();
  } catch {
    throw new HomeDashboardFetchError(
      'HOME_DASHBOARD_UPSTREAM_INVALID',
      'Home dashboard response JSON is malformed.',
    );
  }
}

async function fetchHomeDashboard(): Promise<HomeDashboardResponse> {
  let response: Response;
  try {
    response = await fetch('/api/home/dashboard', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    throw new HomeDashboardFetchError(
      'HOME_DASHBOARD_UPSTREAM_UNAVAILABLE',
      'Home dashboard request failed.',
    );
  }

  if (!response.ok) {
    throw new HomeDashboardFetchError(
      'HOME_DASHBOARD_UPSTREAM_UNAVAILABLE',
      'Home dashboard upstream returned an error status.',
    );
  }

  const parsed = homeDashboardResponseSchema.safeParse(await readHomeDashboardJson(response));
  if (!parsed.success) {
    throw new HomeDashboardFetchError(
      'HOME_DASHBOARD_UPSTREAM_INVALID',
      'Home dashboard response did not match the public contract.',
    );
  }

  return parsed.data;
}

export const homeApi = {
  getDashboard: fetchHomeDashboard,

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

  isNextSeasonRegistered: async (): Promise<boolean> => {
    const mock = await getMockData();
    return mock?.homeService.isNextSeasonRegistered() ?? true;
  },

  getUnreadMessages: async (): Promise<number> => {
    const mock = await getMockData();
    return mock?.homeService.getUnreadMessages() ?? 0;
  },

  getPastSeasons: async (): Promise<PastSeasonData[]> => {
    const mock = await getMockData();
    return mock?.homeService.getPastSeasons() ?? [];
  },
};
