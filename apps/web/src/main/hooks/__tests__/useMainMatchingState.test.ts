import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMainMatchingState } from '../useMainMatchingState';
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

function setup(seasonActive = false) {
  const toasts: string[] = [];
  const showToast = (msg: string) => toasts.push(msg);
  const hook = renderHook(() =>
    useMainMatchingState(
      showToast,
      userLifestyle,
      TEST_USER_ID,
      seasonActive,
      mockProfiles,
      [],
      null,
    ),
  );
  return { hook, toasts };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('useMainMatchingState — 요청 전송', () => {
  it('매칭 요청을 보내면 matchRequests에 추가된다', () => {
    const { hook, toasts } = setup();
    act(() => hook.result.current.handleSendRequest('target-1'));
    expect(hook.result.current.matchRequests).toHaveLength(1);
    expect(hook.result.current.matchRequests[0]).toMatchObject({
      fromUserId: TEST_USER_ID,
      toUserId: 'target-1',
      status: 'PENDING',
    });
    expect(toasts).toContain('매칭 요청을 보냈어요');
  });

  it('메시지를 포함하여 요청할 수 있다', () => {
    const { hook } = setup();
    act(() => hook.result.current.handleSendRequest('target-1', '안녕하세요!'));
    expect(hook.result.current.matchRequests[0]?.message).toBe('안녕하세요!');
  });

  it('요청에 expiresAt이 설정된다', () => {
    const { hook } = setup();
    act(() => hook.result.current.handleSendRequest('target-1'));
    const req = hook.result.current.matchRequests[0]!;
    const created = new Date(req.createdAt).getTime();
    const expires = new Date(req.expiresAt!).getTime();
    const diffHours = (expires - created) / (1000 * 60 * 60);
    expect(diffHours).toBe(120);
  });
});

describe('useMainMatchingState — 요청 취소', () => {
  it('요청을 취소하면 CANCELLED 상태가 된다', () => {
    const { hook, toasts } = setup();
    act(() => hook.result.current.handleSendRequest('target-1'));
    const reqId = hook.result.current.matchRequests[0]!.id;
    act(() => hook.result.current.handleCancelRequest(reqId));
    expect(hook.result.current.matchRequests[0]?.status).toBe('CANCELLED');
    expect(toasts).toContain('매칭 요청을 취소했어요');
  });
});

describe('useMainMatchingState — 요청 수락', () => {
  it('수락 시 activeMatch가 설정되고, 다른 PENDING 요청은 CANCELLED 된다', () => {
    const { hook } = setup();
    // 먼저 2개 요청 생성
    act(() => hook.result.current.handleSendRequest('target-1'));
    act(() => hook.result.current.handleSendRequest('target-2'));
    // 받은 요청 추가를 시뮬레이션하기 위해 partner-1이 보낸 요청 추가
    // 실제로는 서버에서 오지만, mock에서는 직접 테스트
    const reqId = hook.result.current.matchRequests[0]!.id;

    act(() => hook.result.current.handleAcceptRequest(reqId));

    expect(hook.result.current.activeMatch).not.toBeNull();
    // 나머지 PENDING 요청은 CANCELLED
    const otherReqs = hook.result.current.matchRequests.filter((r) => r.id !== reqId);
    for (const r of otherReqs) {
      if (r.status !== 'CANCELLED') {
        // 만료된 요청은 그대로
        expect(r.status).not.toBe('PENDING');
      }
    }
  });

  it('수락 시 celebration 모달 데이터가 설정된다', () => {
    const { hook } = setup();
    act(() => hook.result.current.handleSendRequest('partner-1'));
    const reqId = hook.result.current.matchRequests[0]!.id;
    act(() => hook.result.current.handleAcceptRequest(reqId));

    expect(hook.result.current.showCelebration).not.toBeNull();
    // partner 닉네임/점수 계산은 mockProfiles에서 partner-1을 찾아 사용한다.
    expect(hook.result.current.showCelebration?.nickname).toBeDefined();
  });

  it('celebration 닫기', () => {
    const { hook } = setup();
    act(() => hook.result.current.handleSendRequest('partner-1'));
    const reqId = hook.result.current.matchRequests[0]!.id;
    act(() => hook.result.current.handleAcceptRequest(reqId));
    act(() => hook.result.current.closeCelebration());
    expect(hook.result.current.showCelebration).toBeNull();
  });
});

describe('useMainMatchingState — 요청 거절', () => {
  it('거절 시 REJECTED 상태 + rejectedAt 설정', () => {
    const { hook, toasts } = setup();
    act(() => hook.result.current.handleSendRequest('target-1'));
    const reqId = hook.result.current.matchRequests[0]!.id;
    act(() => hook.result.current.handleRejectRequest(reqId));
    const req = hook.result.current.matchRequests[0]!;
    expect(req.status).toBe('REJECTED');
    expect(req.rejectedAt).toBeTruthy();
    expect(toasts).toContain('매칭 요청을 거절했어요');
  });
});

describe('useMainMatchingState — 매칭 해제', () => {
  it('매칭 해제 시 activeMatch가 null이 된다', () => {
    const { hook, toasts } = setup();
    act(() => hook.result.current.handleSendRequest('partner-1'));
    const reqId = hook.result.current.matchRequests[0]!.id;
    act(() => hook.result.current.handleAcceptRequest(reqId));
    expect(hook.result.current.activeMatch).not.toBeNull();

    act(() => hook.result.current.handleEndMatch());
    expect(hook.result.current.activeMatch).toBeNull();
    expect(toasts).toContain('매칭이 해제되었어요');
  });
});
