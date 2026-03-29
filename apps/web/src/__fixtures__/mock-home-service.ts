import type { RoommateProfile, UserProfile } from '@/types/profile';
import type { BuildingStats, PastSeasonResult } from '@/main/types/home';
import type { PastSeasonData } from '@/types/match';
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

  /** 과거 시즌 이력 (매칭 탭 "과거 이력" 서브탭용) */
  getPastSeasons(): PastSeasonData[] {
    const { pastSeason } = mockDb.getHomeDashboardState();

    // 참여 기록 없으면 빈 배열
    if (pastSeason === 'none') return [];

    const seasons: PastSeasonData[] = [
      {
        id: 'ps-1',
        name: '2025-1학기',
        matchResult: pastSeason === 'matched' ? 'success' : 'no_match',
        matchedWith: pastSeason === 'matched' ? '홍길동' : undefined,
        receivedCount: pastSeason === 'matched' ? 5 : 8,
        sentCount: pastSeason === 'matched' ? 2 : 3,
        chatCount: pastSeason === 'matched' ? 3 : 2,
        history:
          pastSeason === 'matched'
            ? [
                { id: 'ph-1', nickname: '홍길동', status: 'UNMATCHED', date: '2025-06-20' },
                {
                  id: 'ph-2',
                  nickname: '바람소리',
                  status: 'CONVERSATION_ENDED',
                  date: '2025-06-15',
                },
                { id: 'ph-3', nickname: '달빛소년', status: 'EXPIRED', date: '2025-06-10' },
              ]
            : [
                { id: 'ph-4', nickname: '구름여행', status: 'REJECTED', date: '2025-06-18' },
                { id: 'ph-5', nickname: '새벽별', status: 'EXPIRED', date: '2025-06-12' },
                { id: 'ph-6', nickname: '산들바람', status: 'CANCELLED', date: '2025-06-08' },
              ],
      },
      {
        id: 'ps-2',
        name: '2024-2학기',
        matchResult: 'no_match',
        receivedCount: 4,
        sentCount: 2,
        chatCount: 1,
        history: [
          { id: 'ph-7', nickname: '봄소식', status: 'EXPIRED', date: '2024-12-25' },
          { id: 'ph-8', nickname: '겨울밤', status: 'CANCELLED', date: '2024-12-20' },
        ],
      },
    ];

    return seasons;
  }
}

const mockHomeService = new MockHomeService();

export function getMockHomeService(): MockHomeService {
  return mockHomeService;
}
