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
      // 가장 최근 시즌: 프리셋에 따라 성공/미성사
      {
        id: 'ps-1',
        name: '2025-1학기',
        dormitoryIdSnapshot: 'toegye',
        matchResult: pastSeason === 'matched' ? 'success' : 'no_match',
        matchedWith: pastSeason === 'matched' ? '홍길동' : undefined,
        receivedCount: pastSeason === 'matched' ? 7 : 8,
        sentCount: pastSeason === 'matched' ? 3 : 3,
        chatCount: pastSeason === 'matched' ? 4 : 2,
        history:
          pastSeason === 'matched'
            ? [
                { id: 'ph-1', nickname: '홍길동', preset: 'MATCHED_SUCCESS' },
                {
                  id: 'ph-2',
                  nickname: '바람소리',
                  status: 'CONVERSATION_ENDED',
                  stage: 'CONVERSATION',
                  resolvedBy: 'self',
                  date: '2025-06-15',
                },
                {
                  id: 'ph-3',
                  nickname: '달빛소년',
                  status: 'EXPIRED',
                  stage: 'SENT_REQUEST',
                  resolvedBy: 'system',
                  date: '2025-06-10',
                },
                {
                  id: 'ph-4',
                  nickname: '여름하늘',
                  status: 'REJECTED',
                  stage: 'SENT_REQUEST',
                  resolvedBy: 'other',
                  date: '2025-06-05',
                },
                {
                  id: 'ph-5',
                  nickname: '가을단풍',
                  status: 'CANCELLED',
                  stage: 'SENT_REQUEST',
                  resolvedBy: 'self',
                  date: '2025-06-01',
                },
              ]
            : [
                {
                  id: 'ph-6',
                  nickname: '구름여행',
                  status: 'REJECTED',
                  stage: 'RECEIVED_REQUEST',
                  resolvedBy: 'self',
                  date: '2025-06-18',
                },
                {
                  id: 'ph-7',
                  nickname: '새벽별',
                  status: 'EXPIRED',
                  stage: 'SENT_REQUEST',
                  resolvedBy: 'system',
                  date: '2025-06-12',
                },
                {
                  id: 'ph-8',
                  nickname: '산들바람',
                  preset: 'RECEIVED_CANCELLED',
                },
                {
                  id: 'ph-8b',
                  nickname: '산들바람',
                  preset: 'RECEIVED_CANCELLED',
                },
                {
                  id: 'ph-9',
                  nickname: '달빛정원',
                  status: 'CONVERSATION_ENDED',
                  stage: 'CONVERSATION',
                  resolvedBy: 'system',
                  date: '2025-06-03',
                },
                {
                  id: 'ph-10',
                  nickname: '봄꽃향기',
                  status: 'EXPIRED',
                  stage: 'RECEIVED_REQUEST',
                  resolvedBy: 'system',
                  date: '2025-05-28',
                },
              ],
      },
      // 2번째 시즌: 매칭 성공 이력
      {
        id: 'ps-2',
        name: '2024-2학기',
        dormitoryIdSnapshot: 'dasan',
        matchResult: 'success',
        matchedWith: '별빛여행',
        receivedCount: 6,
        sentCount: 2,
        chatCount: 3,
        history: [
          { id: 'ph-11', nickname: '별빛여행', preset: 'MATCHED_SUCCESS' },
          {
            id: 'ph-12',
            nickname: '겨울밤',
            status: 'CONVERSATION_ENDED',
            stage: 'CONVERSATION',
            resolvedBy: 'other',
            date: '2024-12-15',
          },
          {
            id: 'ph-13',
            nickname: '눈꽃소리',
            status: 'EXPIRED',
            stage: 'SENT_REQUEST',
            resolvedBy: 'system',
            date: '2024-12-10',
          },
          {
            id: 'ph-14',
            nickname: '은하수길',
            status: 'REJECTED',
            stage: 'SENT_REQUEST',
            resolvedBy: 'other',
            date: '2024-12-05',
          },
        ],
      },
      // 3번째 시즌: 미성사
      {
        id: 'ps-3',
        name: '2024-1학기',
        dormitoryIdSnapshot: 'saerom',
        matchResult: 'no_match',
        receivedCount: 3,
        sentCount: 1,
        chatCount: 0,
        history: [
          {
            id: 'ph-15',
            nickname: '봄소식',
            status: 'EXPIRED',
            stage: 'SENT_REQUEST',
            resolvedBy: 'system',
            date: '2024-06-25',
          },
          {
            id: 'ph-16',
            nickname: '여름바다',
            preset: 'MATCH_UNMATCHED',
          },
          {
            id: 'ph-17',
            nickname: '가을하늘',
            status: 'REJECTED',
            stage: 'RECEIVED_REQUEST',
            resolvedBy: 'self',
            date: '2024-06-15',
          },
          {
            id: 'ph-18',
            nickname: '여름노을',
            status: 'CANCELLED',
            stage: 'SENT_REQUEST',
            resolvedBy: 'self',
            date: '2024-06-10',
          },
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
