import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMainMatchingState } from '../useMainMatchingState';
import type { UserProfile } from '@/types/profile';

// 시즌 비활성으로 mock — 초기 상태를 빈 배열로 시작
vi.mock('@/constants/season', () => ({
  CURRENT_SEASON: {
    name: 'test',
    matchingStart: '2020-01-01',
    matchingEnd: '2020-01-02',
    roomSelectionStart: '2020-01-03',
    roomSelectionEnd: '2020-01-04',
  },
  isSeasonActive: () => false,
}));

vi.mock('@/__fixtures__/profiles', () => ({
  mockRawProfiles: [
    {
      id: 'partner-1',
      nickname: '파트너',
      gender: 'M',
      dormitoryId: 'dasan',
      lifestyle: {
        bedtime: '22_24',
        wakeTime: '07_08',
        sleepHabit: 'NONE',
        sleepEnvironment: 'QUIET',
        screenUsage: 'NONE',
        noiseSensitivity: 'NORMAL',
        smokingBehavior: 'NO',
        indoorEating: 'OK',
        phoneBehavior: 'BRIEF',
        earphoneUsage: 'STUDY',
        cleanLevel: 'WEEKLY_1_2',
        drinkingFrequency: 'SOMETIMES',
        relationshipStyle: 'CASUAL',
        temperatureSensitivity: 'NORMAL',
        smokingTolerance: 'E_CIG_OK',
        phoneTolerance: 'BRIEF_OK',
        earphoneExpectation: 'STUDY',
        sleepEnvPreference: 'SPEAKER_OK',
        screenTolerance: 'SCREEN_OK',
        cleanExpectation: 'BASIC',
        drinkingTolerance: 'SOMETIMES_OK',
      },
      intro: '',
      messageToRoommate: null,
      additional: { college: null, grade: null, mbti: null, birthYear: null },
    },
  ],
}));

vi.mock('@/__fixtures__/matching', () => ({
  createMockRequests: () => [],
  MOCK_ACTIVE_MATCH: null,
}));

const userLifestyle: UserProfile['lifestyle'] = {
  bedtime: '22_24',
  wakeTime: '07_08',
  sleepHabit: 'NONE',
  sleepEnvironment: 'QUIET',
  screenUsage: 'NONE',
  noiseSensitivity: 'NORMAL',
  smokingBehavior: 'NO',
  indoorEating: 'OK',
  phoneBehavior: 'BRIEF',
  earphoneUsage: 'STUDY',
  cleanLevel: 'WEEKLY_1_2',
  drinkingFrequency: 'SOMETIMES',
  relationshipStyle: 'CASUAL',
  temperatureSensitivity: 'NORMAL',
  smokingTolerance: 'E_CIG_OK',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'STUDY',
  sleepEnvPreference: 'SPEAKER_OK',
  screenTolerance: 'SCREEN_OK',
  cleanExpectation: 'BASIC',
  drinkingTolerance: 'SOMETIMES_OK',
};

const TEST_USER_ID = 'test-user-0001';

function setup() {
  const toasts: string[] = [];
  const showToast = (msg: string) => toasts.push(msg);
  const hook = renderHook(() => useMainMatchingState(showToast, userLifestyle, TEST_USER_ID));
  return { hook, toasts };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('useMainMatchingState — 요청 전송', () => {
  it('매칭 요청을 보내면 matchRequests에 추가된다', () => {
    const { hook, toasts } = setup();

    act(() => hook.result.current.handleSendRequest('target-1', '안녕하세요'));

    expect(hook.result.current.matchRequests).toHaveLength(1);
    const req = hook.result.current.matchRequests[0]!;
    expect(req.toUserId).toBe('target-1');
    expect(req.status).toBe('PENDING');
    expect(req.message).toBe('안녕하세요');
    expect(toasts).toContain('매칭 요청을 보냈어요');
  });

  it('메시지 없이 요청하면 message가 null이다', () => {
    const { hook } = setup();

    act(() => hook.result.current.handleSendRequest('target-1'));

    expect(hook.result.current.matchRequests[0]!.message).toBeNull();
  });
});

describe('useMainMatchingState — 요청 취소', () => {
  it('요청을 취소하면 CANCELED 상태가 된다', () => {
    const { hook, toasts } = setup();

    act(() => hook.result.current.handleSendRequest('target-1'));
    const requestId = hook.result.current.matchRequests[0]!.id;

    act(() => hook.result.current.handleCancelRequest(requestId));

    expect(hook.result.current.matchRequests[0]!.status).toBe('CANCELED');
    expect(toasts).toContain('매칭 요청을 취소했어요');
  });
});

describe('useMainMatchingState — 요청 수락', () => {
  it('수락 시 activeMatch가 설정되고 축하 모달이 트리거된다', () => {
    const { hook } = setup();

    // ⚠️ 훅 API 한계: handleSendRequest는 currentUserId를 fromUserId로 사용하므로
    // "받은 요청(fromUserId=상대)" 시나리오를 재현할 수 없음.
    // 여기서는 상태 전이(PENDING→ACTIVE, celebration 트리거)를 검증한다.
    // partner 닉네임/점수 계산은 mockRawProfiles에 currentUserId가 없어 fallback 경로를 탄다.
    act(() => hook.result.current.handleSendRequest('target-1'));

    const requestId = hook.result.current.matchRequests[0]!.id;
    act(() => hook.result.current.handleAcceptRequest(requestId));

    const match = hook.result.current.activeMatch!;
    expect(match.partnerUserId).toBe(TEST_USER_ID);
    expect(match.partnerNickname).toBe(TEST_USER_ID); // fallback: profile 미발견 시 partnerId 사용
    expect(match.matchScore).toBe(0); // fallback: profile 미발견 시 0
    expect(match.matchedAt).toBeTruthy();

    const celebration = hook.result.current.showCelebration!;
    expect(celebration.nickname).toBe(TEST_USER_ID);
    expect(celebration.score).toBe(0);
  });

  it('수락 시 다른 PENDING 요청이 CANCELED로 전환된다', () => {
    const { hook } = setup();

    act(() => hook.result.current.handleSendRequest('target-1'));
    act(() => hook.result.current.handleSendRequest('target-2'));
    act(() => hook.result.current.handleSendRequest('target-3'));

    const requests = hook.result.current.matchRequests;
    expect(requests).toHaveLength(3);

    // 첫 번째 요청 수락
    act(() => hook.result.current.handleAcceptRequest(requests[0]!.id));

    const updated = hook.result.current.matchRequests;
    expect(updated[0]!.status).toBe('ACTIVE');
    expect(updated[1]!.status).toBe('CANCELED');
    expect(updated[2]!.status).toBe('CANCELED');
  });
});

describe('useMainMatchingState — 요청 거절', () => {
  it('거절 시 REJECTED 상태 + rejectedAt이 설정된다', () => {
    const { hook, toasts } = setup();

    act(() => hook.result.current.handleSendRequest('target-1'));
    const requestId = hook.result.current.matchRequests[0]!.id;

    act(() => hook.result.current.handleRejectRequest(requestId));

    const req = hook.result.current.matchRequests[0]!;
    expect(req.status).toBe('REJECTED');
    expect(req.rejectedAt).not.toBeNull();
    expect(toasts).toContain('매칭 요청을 거절했어요');
  });
});

describe('useMainMatchingState — 매칭 해제', () => {
  it('매칭 해제 시 activeMatch가 null이 된다', () => {
    const { hook, toasts } = setup();

    act(() => hook.result.current.handleSendRequest('target-1'));
    act(() => hook.result.current.handleAcceptRequest(hook.result.current.matchRequests[0]!.id));
    expect(hook.result.current.activeMatch).not.toBeNull();

    act(() => hook.result.current.handleEndMatch());

    expect(hook.result.current.activeMatch).toBeNull();
    expect(toasts).toContain('매칭이 해제되었어요');
  });
});

describe('useMainMatchingState — 축하 모달', () => {
  it('closeCelebration으로 모달을 닫을 수 있다', () => {
    const { hook } = setup();

    act(() => hook.result.current.handleSendRequest('target-1'));
    act(() => hook.result.current.handleAcceptRequest(hook.result.current.matchRequests[0]!.id));
    expect(hook.result.current.showCelebration).not.toBeNull();

    act(() => hook.result.current.closeCelebration());
    expect(hook.result.current.showCelebration).toBeNull();
  });
});

describe('useMainMatchingState — receivedPendingCount', () => {
  it('초기 상태에서 0이다', () => {
    const { hook } = setup();
    expect(hook.result.current.receivedPendingCount).toBe(0);
  });
});
