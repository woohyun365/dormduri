import type { RoommateProfile, UserProfile } from '@/types/profile';
import type { BuildingStats, PastSeasonResult } from '@/main/types/home';
import { buildMainBuildingStats } from '@/main/utils/buildMainBuildingStats';
import { mockDb } from './mock-db';

class MockHomeService {
  getBuildingStats(
    user: UserProfile,
    profiles: Omit<RoommateProfile, 'matchScore'>[],
  ): BuildingStats {
    const dashboard = mockDb.getHomeDashboardState();
    return buildMainBuildingStats(user, profiles, dashboard.buildingStats);
  }

  getPastSeasonResult(): PastSeasonResult | undefined {
    const { pastSeason } = mockDb.getHomeDashboardState();
    if (pastSeason === 'matched') {
      return {
        matched: true,
        partnerName: '홍길동',
        totalRequests: 5,
        sentRequests: 2,
        totalChats: 3,
      };
    }
    if (pastSeason === 'failed') {
      return {
        matched: false,
        totalRequests: 8,
        sentRequests: 3,
        totalChats: 2,
      };
    }
    return undefined;
  }

  isNextSeasonRegistered(): boolean {
    return mockDb.getHomeDashboardState().nextSeasonRegistered;
  }

  getUnreadMessages(): number {
    return mockDb.getHomeDashboardState().unreadMessages;
  }
}

const mockHomeService = new MockHomeService();

export function getMockHomeService(): MockHomeService {
  return mockHomeService;
}
