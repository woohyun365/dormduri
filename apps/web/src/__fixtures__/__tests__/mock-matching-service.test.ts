import { beforeEach, describe, expect, it } from 'vitest';
import { getMockMatchingService, resetMockMatchingService } from '../mock-matching-service';
import { mockRawProfiles } from '../profiles';
import { mockDb } from '../mock-db';

beforeEach(() => {
  localStorage.clear();
  resetMockMatchingService();
});

describe('mockMatchingService initFromCounts', () => {
  it('홈 DevTool 카운트 기반 생성 시 같은 건물 fixture를 우선 사용한다', () => {
    mockDb.setCurrentUser({
      id: 'dev-user',
      email: 'dev@kangwon.ac.kr',
      password: 'pw',
      nickname: '개발유저',
      gender: 'M',
      campus: 'CHUNCHEON',
      dormitoryId: 'dasan',
      lifestyle: {} as any,
      intro: '',
      lastDrinkingChangeSeasonId: null,
    });

    const service = getMockMatchingService();
    service.initFromCounts('dev-user', { sent: 1, received: 1, chats: 1 });
    const state = service.getState('dev-user');

    const sameDormitoryIds = new Set(
      mockRawProfiles
        .filter(
          (profile) =>
            profile.id !== 'dev-user' &&
            profile.dormitoryId === 'dasan' &&
            profile.campus === 'CHUNCHEON' &&
            profile.gender === 'M',
        )
        .map((profile) => profile.id),
    );

    const generatedPartnerIds = state.requests
      .filter((request) => ['PENDING', 'IN_CONVERSATION'].includes(request.status))
      .map((request) =>
        request.fromUserId === 'dev-user' ? request.toUserId : request.fromUserId,
      );

    expect(generatedPartnerIds).toHaveLength(3);
    expect(generatedPartnerIds.every((id) => sameDormitoryIds.has(id))).toBe(true);
  });
});
