// TODO: BE API 연동 시 실제 endpoint로 교체

import type { MatchRequest, ActiveMatch } from '@/types/match';

async function getMockData() {
  if (process.env.NODE_ENV === 'development') {
    const { createMockRequests, MOCK_ACTIVE_MATCH } = await import('@/__fixtures__/matching');
    const { mockDb } = await import('@/__fixtures__/mock-db');
    return { createMockRequests, MOCK_ACTIVE_MATCH, mockDb };
  }
  return null;
}

export const matchingApi = {
  getMatchRequests: async (): Promise<MatchRequest[]> => {
    const mock = await getMockData();
    if (mock) {
      const user = mock.mockDb.getCurrentUser();
      if (!user) return [];
      return mock.createMockRequests(user.id);
    }
    // TODO: GET /api/matches/requests
    return [];
  },

  getActiveMatch: async (): Promise<ActiveMatch | null> => {
    const mock = await getMockData();
    if (mock) {
      return mock.MOCK_ACTIVE_MATCH;
    }
    // TODO: GET /api/matches/active
    return null;
  },

  sendRequest: async (
    targetId: string,
    message: string | null,
  ): Promise<{ success: boolean; error?: string }> => {
    const mock = await getMockData();
    if (mock) {
      console.log(`[Mock] 매칭 요청: → ${targetId}, message: ${message}`);
      return { success: true };
    }
    // TODO: POST /api/matches/requests
    return { success: false, error: '서버 연동 준비 중입니다.' };
  },

  respondToRequest: async (
    requestId: string,
    accept: boolean,
  ): Promise<{ success: boolean; error?: string }> => {
    const mock = await getMockData();
    if (mock) {
      console.log(`[Mock] 매칭 응답: ${requestId} → ${accept ? '수락' : '거절'}`);
      return { success: true };
    }
    // TODO: PATCH /api/matches/requests/{id}
    return { success: false, error: '서버 연동 준비 중입니다.' };
  },
};
