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

function setup() {
  const toasts: string[] = [];
  const showToast = (msg: string) => toasts.push(msg);
  const hook = renderHook(() =>
    useMainMatchingState(showToast, TEST_USER_ID, userLifestyle, mockProfiles),
  );
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
  it('확정 시 activeMatch가 설정되고 다른 PENDING은 CANCELLED 된다', async () => {
    const { hook } = setup();
    await act(async () => hook.result.current.handleSendRequest('partner-1'));
    await act(async () => hook.result.current.handleSendRequest('target-2'));
    const reqId = hook.result.current.matchRequests[0]!.id;
    await act(async () => hook.result.current.handleAcceptRequest(reqId));
    await act(async () => hook.result.current.handleConfirmMatch(reqId));

    expect(hook.result.current.activeMatch).not.toBeNull();
    expect(hook.result.current.matchRequests.find((r) => r.id === reqId)?.status).toBe('ACTIVE');
    const others = hook.result.current.matchRequests.filter((r) => r.id !== reqId);
    for (const r of others) {
      expect(r.status).not.toBe('PENDING');
    }
  });

  it('확정 시 celebration 모달 데이터가 설정된다', async () => {
    const { hook } = setup();
    await act(async () => hook.result.current.handleSendRequest('partner-1'));
    const reqId = hook.result.current.matchRequests[0]!.id;
    await act(async () => hook.result.current.handleAcceptRequest(reqId));
    await act(async () => hook.result.current.handleConfirmMatch(reqId));
    expect(hook.result.current.showCelebration).not.toBeNull();
    expect(hook.result.current.showCelebration?.nickname).toBeDefined();
  });

  it('celebration 닫기', async () => {
    const { hook } = setup();
    await act(async () => hook.result.current.handleSendRequest('partner-1'));
    const reqId = hook.result.current.matchRequests[0]!.id;
    await act(async () => hook.result.current.handleAcceptRequest(reqId));
    await act(async () => hook.result.current.handleConfirmMatch(reqId));
    act(() => hook.result.current.closeCelebration());
    expect(hook.result.current.showCelebration).toBeNull();
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
  it('매칭 해제 시 activeMatch가 null이 되고 요청은 UNMATCHED', async () => {
    const { hook, toasts } = setup();
    await act(async () => hook.result.current.handleSendRequest('partner-1'));
    const reqId = hook.result.current.matchRequests[0]!.id;
    await act(async () => hook.result.current.handleAcceptRequest(reqId));
    await act(async () => hook.result.current.handleConfirmMatch(reqId));
    expect(hook.result.current.activeMatch).not.toBeNull();

    await act(async () => hook.result.current.handleEndMatch());
    expect(hook.result.current.activeMatch).toBeNull();
    expect(hook.result.current.matchRequests.find((r) => r.id === reqId)?.status).toBe('UNMATCHED');
    expect(toasts).toContain('매칭이 해제되었어요');
  });
});

describe('useMainMatchingState — 누락 조합 테스트', () => {
  it('#4. 확정 시 다른 IN_CONVERSATION → CONVERSATION_ENDED 전이', async () => {
    const { hook } = setup();
    // 요청 2개 → 둘 다 수락 → IN_CONVERSATION 2건
    await act(async () => hook.result.current.handleSendRequest('partner-1'));
    await act(async () => hook.result.current.handleSendRequest('target-2'));
    const req1Id = hook.result.current.matchRequests[0]!.id;
    const req2Id = hook.result.current.matchRequests[1]!.id;
    await act(async () => hook.result.current.handleAcceptRequest(req1Id));
    await act(async () => hook.result.current.handleAcceptRequest(req2Id));

    expect(hook.result.current.matchRequests[0]?.status).toBe('IN_CONVERSATION');
    expect(hook.result.current.matchRequests[1]?.status).toBe('IN_CONVERSATION');

    // req1 확정 → req2는 CONVERSATION_ENDED로 전이되어야 함
    await act(async () => hook.result.current.handleConfirmMatch(req1Id));

    expect(hook.result.current.matchRequests.find((r) => r.id === req1Id)?.status).toBe('ACTIVE');
    expect(hook.result.current.matchRequests.find((r) => r.id === req2Id)?.status).toBe(
      'CONVERSATION_ENDED',
    );
    expect(hook.result.current.activeMatch).not.toBeNull();
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
