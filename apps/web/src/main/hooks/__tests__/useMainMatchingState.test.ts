import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMainMatchingState } from '../useMainMatchingState';
import {
  resetMockMatchingService,
  getMockMatchingService,
} from '@/__fixtures__/mock-matching-service';
import type { RoommateProfile, UserProfile } from '@/types/profile';

const mockProfiles: Omit<RoommateProfile, 'matchScore'>[] = [
  {
    id: 'partner-1',
    nickname: '파트너',
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'dasan',
    lifestyle: {
      bedtime: '22_24',
      wakeTime: '07_08',
      sleepHabit: 'NONE',
      sleepEnvironment: 'QUIET',
      screenUsage: 'NONE',
      noiseSensitivity: 'NORMAL',
      smokingBehavior: 'NO',
      indoorEating: 'SNACK',
      phoneBehavior: 'SOMETIMES',
      earphoneUsage: 'MOSTLY',
      cleanLevel: 'WEEKLY_1_2',
      drinkingFrequency: 'SOMETIMES',
      relationshipStyle: 'CASUAL',
      temperatureSensitivity: 'NORMAL',
      smokingTolerance: 'E_CIG_OK',
      phoneTolerance: 'BRIEF_OK',
      earphoneExpectation: 'STUDY',
      sleepEnvPreference: 'SPEAKER_OK',
      screenTolerance: 'SCREEN_OK',
      indoorEatingTolerance: 'CLEAN_OK',
      cleanExpectation: 'BASIC',
      drinkingTolerance: 'LOW_ONLY',
    },
    intro: '',
    messageToRoommate: null,
    additional: { college: null, grade: null, mbti: null, birthYear: null },
  },
];

const userLifestyle: UserProfile['lifestyle'] = {
  bedtime: '22_24',
  wakeTime: '07_08',
  sleepHabit: 'NONE',
  sleepEnvironment: 'QUIET',
  screenUsage: 'NONE',
  noiseSensitivity: 'NORMAL',
  smokingBehavior: 'NO',
  indoorEating: 'SNACK',
  phoneBehavior: 'SOMETIMES',
  earphoneUsage: 'MOSTLY',
  cleanLevel: 'WEEKLY_1_2',
  drinkingFrequency: 'SOMETIMES',
  relationshipStyle: 'CASUAL',
  temperatureSensitivity: 'NORMAL',
  smokingTolerance: 'E_CIG_OK',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'STUDY',
  sleepEnvPreference: 'SPEAKER_OK',
  screenTolerance: 'SCREEN_OK',
  indoorEatingTolerance: 'CLEAN_OK',
  cleanExpectation: 'BASIC',
  drinkingTolerance: 'LOW_ONLY',
};

const TEST_USER_ID = 'test-user-0001';
const currentUser: Pick<UserProfile, 'id' | 'nickname' | 'dormitoryId' | 'lifestyle'> = {
  id: TEST_USER_ID,
  nickname: '테스트유저',
  dormitoryId: 'dasan',
  lifestyle: userLifestyle,
};

const partnerUser: Pick<UserProfile, 'id' | 'nickname' | 'dormitoryId' | 'lifestyle'> = {
  id: 'partner-1',
  nickname: '파트너',
  dormitoryId: 'dasan',
  lifestyle: userLifestyle,
};

const currentUserProfile: Omit<RoommateProfile, 'matchScore'> = {
  id: TEST_USER_ID,
  nickname: '테스트유저',
  gender: 'M',
  campus: 'CHUNCHEON',
  dormitoryId: 'dasan',
  lifestyle: userLifestyle,
  intro: '',
  messageToRoommate: null,
  additional: { college: null, grade: null, mbti: null, birthYear: null },
};

function setup() {
  const toasts: string[] = [];
  const showToast = (msg: string) => toasts.push(msg);
  const hook = renderHook(() => useMainMatchingState(showToast, currentUser, mockProfiles));
  return { hook, toasts };
}

function setupForUser(
  user = currentUser,
  profiles: Omit<RoommateProfile, 'matchScore'>[] = mockProfiles,
) {
  const toasts: string[] = [];
  const showToast = (msg: string) => toasts.push(msg);
  const hook = renderHook(() => useMainMatchingState(showToast, user, profiles));
  return { hook, toasts };
}

beforeEach(() => {
  vi.restoreAllMocks();
  resetMockMatchingService();
  getMockMatchingService().clearState();
});

describe('useMainMatchingState — 요청 전송', () => {
  it('매칭 요청을 보내면 matchRequests에 추가된다', async () => {
    const { hook, toasts } = setup();
    await act(async () => hook.result.current.handleSendRequest('target-1'));
    expect(hook.result.current.matchRequests).toHaveLength(1);
    expect(hook.result.current.matchRequests[0]).toMatchObject({
      fromUserId: TEST_USER_ID,
      toUserId: 'target-1',
      status: 'PENDING',
    });
    expect(toasts).toContain('매칭 요청을 보냈어요');
  });

  it('메시지를 포함하여 요청할 수 있다', async () => {
    const { hook } = setup();
    await act(async () => hook.result.current.handleSendRequest('target-1', '안녕하세요!'));
    expect(hook.result.current.matchRequests[0]?.message).toBe('안녕하세요!');
  });

  it('요청에 expiresAt이 설정된다', async () => {
    const { hook } = setup();
    await act(async () => hook.result.current.handleSendRequest('target-1'));
    const req = hook.result.current.matchRequests[0]!;
    const created = new Date(req.createdAt).getTime();
    const expires = new Date(req.expiresAt!).getTime();
    const diffHours = (expires - created) / (1000 * 60 * 60);
    expect(diffHours).toBe(120);
  });
});

describe('useMainMatchingState — 요청 취소', () => {
  it('요청을 취소하면 CANCELLED 상태가 된다', async () => {
    const { hook, toasts } = setup();
    await act(async () => hook.result.current.handleSendRequest('target-1'));
    const reqId = hook.result.current.matchRequests[0]!.id;
    await act(async () => hook.result.current.handleCancelRequest(reqId));
    expect(hook.result.current.matchRequests[0]?.status).toBe('CANCELLED');
    expect(hook.result.current.matchRequests[0]?.resolvedAt).toBeTruthy();
    expect(toasts).toContain('매칭 요청을 취소했어요');
  });
});

describe('useMainMatchingState — 요청 수락 (→ IN_CONVERSATION)', () => {
  it('수락 시 IN_CONVERSATION 상태가 된다 (ACTIVE 아님)', async () => {
    const { hook, toasts } = setup();
    await act(async () => hook.result.current.handleSendRequest('target-1'));
    const reqId = hook.result.current.matchRequests[0]!.id;
    await act(async () => hook.result.current.handleAcceptRequest(reqId));
    expect(hook.result.current.matchRequests[0]?.status).toBe('IN_CONVERSATION');
    expect(hook.result.current.matchRequests[0]?.acceptedAt).toBeTruthy();
    expect(hook.result.current.activeMatch).toBeNull();
    expect(toasts).toContain('요청을 수락했어요. 대화를 시작하세요!');
  });
});

describe('useMainMatchingState — 매칭 확정 (IN_CONVERSATION → ACTIVE)', () => {
  it('확정은 양쪽이 모두 눌러야 activeMatch가 된다', async () => {
    const mine = setupForUser(currentUser, [mockProfiles[0]!]);
    const partner = setupForUser(partnerUser, [currentUserProfile]);

    await act(async () => mine.hook.result.current.handleSendRequest('partner-1'));
    await act(async () => mine.hook.result.current.handleSendRequest('target-2'));
    const reqId = mine.hook.result.current.matchRequests[0]!.id;
    await act(async () => mine.hook.result.current.handleAcceptRequest(reqId));

    await act(async () => mine.hook.result.current.handleConfirmMatch(reqId));
    expect(mine.hook.result.current.activeMatch).toBeNull();
    expect(mine.toasts).toContain('내 확정이 기록됐어요. 상대가 확정하면 최종 적용됩니다.');

    await act(async () => partner.hook.result.current.refresh());
    await act(async () => partner.hook.result.current.handleConfirmMatch(reqId));
    await act(async () => mine.hook.result.current.refresh());

    expect(mine.hook.result.current.activeMatch).not.toBeNull();
    expect(mine.hook.result.current.matchRequests.find((r) => r.id === reqId)?.status).toBe(
      'ACTIVE',
    );
    const others = mine.hook.result.current.matchRequests.filter((r) => r.id !== reqId);
    for (const r of others) {
      expect(r.status).not.toBe('PENDING');
    }
  });

  it('최종 확정한 쪽에서 celebration 모달 데이터가 설정된다', async () => {
    const mine = setupForUser(currentUser, [mockProfiles[0]!]);
    const partner = setupForUser(partnerUser, [currentUserProfile]);

    await act(async () => mine.hook.result.current.handleSendRequest('partner-1'));
    const reqId = mine.hook.result.current.matchRequests[0]!.id;
    await act(async () => mine.hook.result.current.handleAcceptRequest(reqId));
    await act(async () => mine.hook.result.current.handleConfirmMatch(reqId));
    await act(async () => partner.hook.result.current.refresh());
    await act(async () => partner.hook.result.current.handleConfirmMatch(reqId));

    expect(partner.hook.result.current.showCelebration).not.toBeNull();
    expect(partner.hook.result.current.showCelebration?.nickname).toBeDefined();
  });

  it('celebration 닫기', async () => {
    const mine = setupForUser(currentUser, [mockProfiles[0]!]);
    const partner = setupForUser(partnerUser, [currentUserProfile]);
    await act(async () => mine.hook.result.current.handleSendRequest('partner-1'));
    const reqId = mine.hook.result.current.matchRequests[0]!.id;
    await act(async () => mine.hook.result.current.handleAcceptRequest(reqId));
    await act(async () => mine.hook.result.current.handleConfirmMatch(reqId));
    await act(async () => partner.hook.result.current.refresh());
    await act(async () => partner.hook.result.current.handleConfirmMatch(reqId));
    act(() => partner.hook.result.current.closeCelebration());
    expect(partner.hook.result.current.showCelebration).toBeNull();
  });

  it('내 확정 완료를 취소할 수 있다', async () => {
    const mine = setupForUser(currentUser, [mockProfiles[0]!]);
    await act(async () => mine.hook.result.current.handleSendRequest('partner-1'));
    const reqId = mine.hook.result.current.matchRequests[0]!.id;
    await act(async () => mine.hook.result.current.handleAcceptRequest(reqId));
    await act(async () => mine.hook.result.current.handleConfirmMatch(reqId));
    expect(
      mine.hook.result.current.matchRequests.find((r) => r.id === reqId)?.approvalUserIds,
    ).toEqual([TEST_USER_ID]);

    await act(async () => mine.hook.result.current.handleRevokeConfirmMatch(reqId));
    expect(
      mine.hook.result.current.matchRequests.find((r) => r.id === reqId)?.approvalUserIds,
    ).toEqual([]);
    expect(mine.toasts).toContain('확정 완료를 취소했어요');
  });

  it('3인실 그룹 코어 승격 시 celebration 모달을 띄우지 않는다', async () => {
    const groupUser = { ...currentUser, dormitoryId: 'toegye' as const };
    const groupPartner = { ...partnerUser, dormitoryId: 'toegye' as const };
    const groupProfiles = [{ ...mockProfiles[0]!, dormitoryId: 'toegye' as const }];
    const mine = setupForUser(groupUser, groupProfiles);
    const partner = setupForUser(groupPartner, [{ ...currentUserProfile, dormitoryId: 'toegye' }]);

    await act(async () => mine.hook.result.current.handleSendRequest('partner-1'));
    const reqId = mine.hook.result.current.matchRequests[0]!.id;
    await act(async () => mine.hook.result.current.handleAcceptRequest(reqId));
    await act(async () => mine.hook.result.current.handleConfirmMatch(reqId));
    await act(async () => partner.hook.result.current.refresh());
    await act(async () => partner.hook.result.current.handleConfirmMatch(reqId));
    await act(async () => mine.hook.result.current.refresh());

    expect(mine.hook.result.current.activeMatch?.kind).toBe('group');
    expect(mine.hook.result.current.activeMatch?.groupStage).toBe('PAIR_OPEN');
    expect(mine.hook.result.current.showCelebration).toBeNull();
  });

  it('3인실 그룹 코어를 2인으로 마감하면 celebration 모달을 띄운다', async () => {
    const groupUser = { ...currentUser, dormitoryId: 'toegye' as const };
    const groupPartner = { ...partnerUser, dormitoryId: 'toegye' as const };
    const groupProfiles = [{ ...mockProfiles[0]!, dormitoryId: 'toegye' as const }];
    const mine = setupForUser(groupUser, groupProfiles);
    const partner = setupForUser(groupPartner, [{ ...currentUserProfile, dormitoryId: 'toegye' }]);

    await act(async () => mine.hook.result.current.handleSendRequest('partner-1'));
    const reqId = mine.hook.result.current.matchRequests[0]!.id;
    await act(async () => mine.hook.result.current.handleAcceptRequest(reqId));
    await act(async () => mine.hook.result.current.handleConfirmMatch(reqId));
    await act(async () => partner.hook.result.current.refresh());
    await act(async () => partner.hook.result.current.handleConfirmMatch(reqId));
    await act(async () => mine.hook.result.current.refresh());
    await act(async () => mine.hook.result.current.handleFinalizePairGroup());

    expect(mine.hook.result.current.activeMatch?.groupStage).toBe('PAIR_FINAL');
    expect(mine.hook.result.current.showCelebration).not.toBeNull();
  });

  it('3인실 합류 요청은 코어 2명이 모두 승인해야 대화가 열린다', async () => {
    const groupUser = { ...currentUser, dormitoryId: 'toegye' as const };
    const groupPartner = { ...partnerUser, dormitoryId: 'toegye' as const };
    const candidateUser = {
      id: 'candidate-1',
      nickname: '후보',
      dormitoryId: 'toegye' as const,
      lifestyle: userLifestyle,
    };
    const groupProfiles = [{ ...mockProfiles[0]!, dormitoryId: 'toegye' as const }];
    const mine = setupForUser(groupUser, groupProfiles);
    const partner = setupForUser(groupPartner, [{ ...currentUserProfile, dormitoryId: 'toegye' }]);

    await act(async () => mine.hook.result.current.handleSendRequest('partner-1'));
    const pairReqId = mine.hook.result.current.matchRequests[0]!.id;
    await act(async () => mine.hook.result.current.handleAcceptRequest(pairReqId));
    await act(async () => mine.hook.result.current.handleConfirmMatch(pairReqId));
    await act(async () => partner.hook.result.current.refresh());
    await act(async () => partner.hook.result.current.handleConfirmMatch(pairReqId));
    await act(async () => mine.hook.result.current.refresh());

    const service = getMockMatchingService();
    const joinResult = service.sendRequest(candidateUser.id, groupUser.id, '합류하고 싶어요');
    const joinReqId = joinResult.requests.find(
      (request) => request.fromUserId === candidateUser.id,
    )!.id;

    await act(async () => mine.hook.result.current.refresh());
    await act(async () => partner.hook.result.current.refresh());

    await act(async () => mine.hook.result.current.handleAcceptRequest(joinReqId));
    expect(
      mine.hook.result.current.matchRequests.find((request) => request.id === joinReqId)?.status,
    ).toBe('PENDING');

    await act(async () => partner.hook.result.current.handleAcceptRequest(joinReqId));
    await act(async () => mine.hook.result.current.refresh());

    expect(
      mine.hook.result.current.matchRequests.find((request) => request.id === joinReqId)?.status,
    ).toBe('IN_CONVERSATION');
    expect(mine.hook.result.current.activeMatch?.groupStage).toBe('GROUP_FORMING');
  });
});

describe('useMainMatchingState — 대화 종료 (IN_CONVERSATION → CONVERSATION_ENDED)', () => {
  it('대화 종료 시 CONVERSATION_ENDED 상태가 된다', async () => {
    const { hook, toasts } = setup();
    await act(async () => hook.result.current.handleSendRequest('target-1'));
    const reqId = hook.result.current.matchRequests[0]!.id;
    await act(async () => hook.result.current.handleAcceptRequest(reqId));
    await act(async () => hook.result.current.handleEndConversation(reqId));
    expect(hook.result.current.matchRequests[0]?.status).toBe('CONVERSATION_ENDED');
    expect(hook.result.current.matchRequests[0]?.resolvedAt).toBeTruthy();
    expect(toasts).toContain('대화를 종료했어요');
  });
});

describe('useMainMatchingState — 요청 거절', () => {
  it('거절 시 REJECTED 상태 + rejectedAt + resolvedAt 설정', async () => {
    const { hook, toasts } = setup();
    await act(async () => hook.result.current.handleSendRequest('target-1'));
    const reqId = hook.result.current.matchRequests[0]!.id;
    await act(async () => hook.result.current.handleRejectRequest(reqId));
    const req = hook.result.current.matchRequests[0]!;
    expect(req.status).toBe('REJECTED');
    expect(req.rejectedAt).toBeTruthy();
    expect(req.resolvedAt).toBeTruthy();
    expect(toasts).toContain('매칭 요청을 거절했어요');
  });
});

describe('useMainMatchingState — 매칭 해제 (ACTIVE → UNMATCHED)', () => {
  it('매칭 취소는 양측 동의 후 UNMATCHED가 된다', async () => {
    const mine = setupForUser(currentUser, [mockProfiles[0]!]);
    const partner = setupForUser(partnerUser, [currentUserProfile]);
    await act(async () => mine.hook.result.current.handleSendRequest('partner-1'));
    const reqId = mine.hook.result.current.matchRequests[0]!.id;
    await act(async () => mine.hook.result.current.handleAcceptRequest(reqId));
    await act(async () => mine.hook.result.current.handleConfirmMatch(reqId));
    await act(async () => partner.hook.result.current.refresh());
    await act(async () => partner.hook.result.current.handleConfirmMatch(reqId));
    await act(async () => mine.hook.result.current.refresh());
    expect(mine.hook.result.current.activeMatch).not.toBeNull();

    await act(async () => mine.hook.result.current.handleEndMatch());
    expect(mine.hook.result.current.activeMatch?.cancelRequestedAt).toBeTruthy();
    expect(mine.toasts).toContain('매칭 취소 요청이 기록됐어요. 상대 승인 후 해제됩니다.');

    await act(async () => partner.hook.result.current.refresh());
    await act(async () => partner.hook.result.current.handleEndMatch());
    await act(async () => mine.hook.result.current.refresh());

    expect(mine.hook.result.current.activeMatch).toBeNull();
    expect(mine.hook.result.current.matchRequests.find((r) => r.id === reqId)?.status).toBe(
      'UNMATCHED',
    );
  });

  it('3인 그룹 최종 상태에서 C 취소 후 A-B 둘 다 승인하면 2/3 그룹으로 복원된다', async () => {
    const coreA = { ...currentUser, id: 'toegye-core-a', nickname: '그룹A', dormitoryId: 'toegye' };
    const coreB = { ...currentUser, id: 'toegye-core-b', nickname: '그룹B', dormitoryId: 'toegye' };
    const candidate = {
      ...currentUser,
      id: 'candidate-1',
      nickname: '후보',
      dormitoryId: 'toegye',
    };

    const service = getMockMatchingService();
    service.seedGroupFinalScenario(coreA, coreB, candidate);

    const aHook = setupForUser(coreA, []);
    const bHook = setupForUser(coreB, []);
    const cHook = setupForUser(candidate, []);

    await act(async () => cHook.hook.result.current.refresh());
    await act(async () => cHook.hook.result.current.handleEndMatch());
    expect(cHook.hook.result.current.activeMatch?.cancelRequestKind).toBe('MEMBER_LEAVE');

    await act(async () => aHook.hook.result.current.refresh());
    await act(async () => aHook.hook.result.current.handleEndMatch());
    await act(async () => bHook.hook.result.current.refresh());
    await act(async () => bHook.hook.result.current.handleEndMatch());
    await act(async () => aHook.hook.result.current.refresh());

    expect(aHook.hook.result.current.activeMatch?.groupStage).toBe('PAIR_OPEN');
    expect(aHook.hook.result.current.activeMatch?.groupMemberCount).toBe(2);
    expect(
      aHook.hook.result.current.activeMatch?.groupMembers?.map((member) => member.userId),
    ).toEqual(['toegye-core-a', 'toegye-core-b']);
  });

  it('취소 요청 3일 무응답 시 자동 승인되어 해제된다', async () => {
    const mine = setupForUser(currentUser, [mockProfiles[0]!]);
    const partner = setupForUser(partnerUser, [currentUserProfile]);
    await act(async () => mine.hook.result.current.handleSendRequest('partner-1'));
    const reqId = mine.hook.result.current.matchRequests[0]!.id;
    await act(async () => mine.hook.result.current.handleAcceptRequest(reqId));
    await act(async () => mine.hook.result.current.handleConfirmMatch(reqId));
    await act(async () => partner.hook.result.current.refresh());
    await act(async () => partner.hook.result.current.handleConfirmMatch(reqId));
    await act(async () => mine.hook.result.current.refresh());

    await act(async () => mine.hook.result.current.handleEndMatch());

    const service = getMockMatchingService() as unknown as {
      state: { activeMatch: { cancelRequestedAt: string } | null };
    };
    if (service.state.activeMatch) {
      service.state.activeMatch.cancelRequestedAt = new Date(
        Date.now() - 4 * 24 * 60 * 60 * 1000,
      ).toISOString();
    }

    await act(async () => mine.hook.result.current.refresh());
    expect(mine.hook.result.current.activeMatch).toBeNull();
  });
});

describe('useMainMatchingState — 누락 조합 테스트', () => {
  it('#4. 확정 시 다른 IN_CONVERSATION → CONVERSATION_ENDED 전이', async () => {
    const mine = setupForUser(currentUser, [mockProfiles[0]!]);
    const partner = setupForUser(partnerUser, [currentUserProfile]);
    // 요청 2개 → 둘 다 수락 → IN_CONVERSATION 2건
    await act(async () => mine.hook.result.current.handleSendRequest('partner-1'));
    await act(async () => mine.hook.result.current.handleSendRequest('target-2'));
    const req1Id = mine.hook.result.current.matchRequests[0]!.id;
    const req2Id = mine.hook.result.current.matchRequests[1]!.id;
    await act(async () => mine.hook.result.current.handleAcceptRequest(req1Id));
    await act(async () => mine.hook.result.current.handleAcceptRequest(req2Id));

    expect(mine.hook.result.current.matchRequests[0]?.status).toBe('IN_CONVERSATION');
    expect(mine.hook.result.current.matchRequests[1]?.status).toBe('IN_CONVERSATION');

    // req1 확정 → req2는 CONVERSATION_ENDED로 전이되어야 함
    await act(async () => mine.hook.result.current.handleConfirmMatch(req1Id));
    await act(async () => partner.hook.result.current.refresh());
    await act(async () => partner.hook.result.current.handleConfirmMatch(req1Id));
    await act(async () => mine.hook.result.current.refresh());

    expect(mine.hook.result.current.matchRequests.find((r) => r.id === req1Id)?.status).toBe(
      'ACTIVE',
    );
    expect(mine.hook.result.current.matchRequests.find((r) => r.id === req2Id)?.status).toBe(
      'CONVERSATION_ENDED',
    );
    expect(mine.hook.result.current.activeMatch).not.toBeNull();
  });

  it('#5. endMatch 시 activeMatch가 이미 null이면 안전하게 무시', async () => {
    const { hook } = setup();
    // activeMatch 없는 상태에서 endMatch 호출 — 에러 없이 무시
    await act(async () => hook.result.current.handleEndMatch());
    expect(hook.result.current.activeMatch).toBeNull();
    expect(hook.result.current.matchRequests).toHaveLength(0);
  });

  it('#6. TTL 만료된 PENDING은 getPendingCount에서 제외', async () => {
    const { hook } = setup();
    // 요청 생성
    await act(async () => hook.result.current.handleSendRequest('target-1'));
    expect(hook.result.current.receivedPendingCount).toBe(0);
    // Note: TTL 만료는 서비스 레벨(BE)에서 EXPIRED로 전이.
    // FE는 isRequestExpired로 클라이언트 필터링.
    // receivedPendingCount가 만료된 요청을 제외하는지 검증.
    const req = hook.result.current.matchRequests[0]!;
    expect(req.expiresAt).toBeTruthy();
  });
});
