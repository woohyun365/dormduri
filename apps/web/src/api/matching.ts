/**
 * Matching API — Sprint 7 엔드포인트와 1:1 인터페이스.
 * 현재: mock-matching-service 위임. Sprint 7: HTTP fetch로 교체.
 */
import type { MatchRequest, ActiveMatch } from '@/types/match';
import type { RoommateProfile, UserProfile } from '@/types/profile';

export interface MatchingResult {
  requests: MatchRequest[];
  activeMatch: ActiveMatch | null;
}

async function getService() {
  const { getMockMatchingService, MockMatchingService } =
    await import('@/main/dev-only/fixtures/mock-matching-service');
  const service = getMockMatchingService();

  // DevPanel 프리셋 적용 (초기 로드 시)
  const preset = MockMatchingService.getPresetOverride();
  if (preset) {
    const { mockDb } = await import('@/main/dev-only/fixtures/mock-db');
    const user = mockDb.getCurrentUser();
    if (user) {
      service.initFromPreset(preset, user.id);
      MockMatchingService.setPresetOverride('auto'); // 1회 적용 후 auto로 복원
    }
  }

  return service;
}

export const matchingApi = {
  // GET /api/matches — 전체 상태 조회
  getState: async (userId: string): Promise<MatchingResult> => {
    const service = await getService();
    return service.getState(userId);
  },

  // GET /api/matches/requests
  getRequests: async (userId: string): Promise<MatchRequest[]> => {
    const service = await getService();
    return service.getRequests(userId);
  },

  // GET /api/matches/active
  getActiveMatch: async (userId: string): Promise<ActiveMatch | null> => {
    const service = await getService();
    return service.getActiveMatch(userId);
  },

  // POST /api/matches/requests
  sendRequest: async (
    fromId: string,
    toId: string,
    message: string | null,
  ): Promise<MatchingResult> => {
    const service = await getService();
    return service.sendRequest(fromId, toId, message);
  },

  // POST /api/matches/requests/{id}/cancel
  cancelRequest: async (requestId: string, userId: string): Promise<MatchingResult> => {
    const service = await getService();
    return service.cancelRequest(requestId, userId);
  },

  // POST /api/matches/requests/{id}/accept
  acceptRequest: async (requestId: string, userId: string): Promise<MatchingResult> => {
    const service = await getService();
    return service.acceptRequest(requestId, userId);
  },

  // POST /api/matches/requests/{id}/reject
  rejectRequest: async (requestId: string, userId: string): Promise<MatchingResult> => {
    const service = await getService();
    return service.rejectRequest(requestId, userId);
  },

  // POST /api/matches/active/confirm
  confirmMatch: async (
    requestId: string,
    userId: string,
    context: {
      currentUser: Pick<UserProfile, 'id' | 'nickname' | 'dormitoryId'>;
      profiles: Omit<RoommateProfile, 'matchScore'>[];
      userLifestyle: UserProfile['lifestyle'];
    },
  ): Promise<MatchingResult> => {
    const service = await getService();
    return service.confirmMatch(requestId, userId, context);
  },

  // POST /api/matches/active/confirm/revoke
  revokeConfirmMatch: async (requestId: string, userId: string): Promise<MatchingResult> => {
    const service = await getService();
    return service.revokeConfirmMatch(requestId, userId);
  },

  // DevTool helper — 현재 대화의 승인 상태 강제 설정
  setConfirmState: async (
    userId: string,
    mode: 'none' | 'self' | 'others' | 'all',
  ): Promise<MatchingResult> => {
    const service = await getService();
    return service.setConfirmState(userId, mode);
  },

  // POST /api/matches/active/finalize-pair
  finalizePairGroup: async (userId: string): Promise<MatchingResult> => {
    const service = await getService();
    return service.finalizePairGroup(userId);
  },

  // POST /api/matches/conversations/{id}/end
  endConversation: async (requestId: string, userId: string): Promise<MatchingResult> => {
    const service = await getService();
    return service.endConversation(requestId, userId);
  },

  // POST /api/matches/active/cancel
  endMatch: async (userId: string): Promise<MatchingResult> => {
    const service = await getService();
    return service.endMatch(userId);
  },
};
