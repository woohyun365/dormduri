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
        smoker: 'NO',
        sleepHabit: 'NONE',
        indoorEating: 'NO',
        bedtime: '22_24',
        wakeTime: '06_08',
        noiseSensitivity: 'MID',
        cleanliness: 'MID',
        relationshipStyle: 'CASUAL',
      },
      intro: '',
      messageToRoommate: null,
      additional: { college: null, grade: null, mbti: null, temperatureSensitivity: null },
    },
  ],
}));

vi.mock('@/__fixtures__/matching', () => ({
  MOCK_REQUESTS: [],
  MOCK_ACTIVE_MATCH: null,
}));

const userLifestyle: UserProfile['lifestyle'] = {
  smoker: 'NO',
  sleepHabit: 'NONE',
  indoorEating: 'NO',
  bedtime: '22_24',
  wakeTime: '06_08',
  noiseSensitivity: 'MID',
  cleanliness: 'MID',
  relationshipStyle: 'CASUAL',
};

function setup() {
  const toasts: string[] = [];
  const showToast = (msg: string) => toasts.push(msg);
  const hook = renderHook(() => useMainMatchingState(showToast, userLifestyle));
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
    expect(hook.result.current.matchRequests[0].toUserId).toBe('target-1');
    expect(hook.result.current.matchRequests[0].status).toBe('PENDING');
    expect(hook.result.current.matchRequests[0].message).toBe('안녕하세요');
    expect(toasts).toContain('매칭 요청을 보냈어요');
  });

  it('메시지 없이 요청하면 message가 null이다', () => {
    const { hook } = setup();

    act(() => hook.result.current.handleSendRequest('target-1'));

    expect(hook.result.current.matchRequests[0].message).toBeNull();
  });
});

describe('useMainMatchingState — 요청 취소', () => {
  it('요청을 취소하면 CANCELED 상태가 된다', () => {
    const { hook, toasts } = setup();

    act(() => hook.result.current.handleSendRequest('target-1'));
    const requestId = hook.result.current.matchRequests[0].id;

    act(() => hook.result.current.handleCancelRequest(requestId));

    expect(hook.result.current.matchRequests[0].status).toBe('CANCELED');
    expect(toasts).toContain('매칭 요청을 취소했어요');
  });
});

describe('useMainMatchingState — 요청 수락', () => {
  it('수락 시 activeMatch가 설정되고 축하 모달이 트리거된다', () => {
    const { hook } = setup();

    // 받은 요청 시뮬레이션
    act(() => hook.result.current.handleSendRequest('me'));
    // fromUserId를 partner-1로 설정한 요청을 직접 주입 (받은 요청)
    const receivedRequest = {
      id: 'req-received',
      fromUserId: 'partner-1',
      toUserId: 'me',
      status: 'PENDING' as const,
      message: null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      rejectedAt: null,
    };

    // 직접 handleSendRequest로는 받은 요청을 만들 수 없으므로,
    // handleAcceptRequest 테스트를 위해 sent 요청을 먼저 만들어 ID로 수락
    // → handleSendRequest는 fromUserId='me'로 고정이므로 수락 로직의 partnerId='me'가 됨
    // 이 테스트는 handleAcceptRequest의 상태 전이 로직을 검증
    act(() => hook.result.current.handleSendRequest('target-2'));

    const requests = hook.result.current.matchRequests;
    const firstReqId = requests[0].id;

    act(() => hook.result.current.handleAcceptRequest(firstReqId));

    expect(hook.result.current.activeMatch).not.toBeNull();
    expect(hook.result.current.showCelebration).not.toBeNull();
  });

  it('수락 시 다른 PENDING 요청이 CANCELED로 전환된다', () => {
    const { hook } = setup();

    act(() => hook.result.current.handleSendRequest('target-1'));
    act(() => hook.result.current.handleSendRequest('target-2'));
    act(() => hook.result.current.handleSendRequest('target-3'));

    const requests = hook.result.current.matchRequests;
    expect(requests).toHaveLength(3);

    // 첫 번째 요청 수락
    act(() => hook.result.current.handleAcceptRequest(requests[0].id));

    const updated = hook.result.current.matchRequests;
    expect(updated[0].status).toBe('ACTIVE');
    expect(updated[1].status).toBe('CANCELED');
    expect(updated[2].status).toBe('CANCELED');
  });
});

describe('useMainMatchingState — 요청 거절', () => {
  it('거절 시 REJECTED 상태 + rejectedAt이 설정된다', () => {
    const { hook, toasts } = setup();

    act(() => hook.result.current.handleSendRequest('target-1'));
    const requestId = hook.result.current.matchRequests[0].id;

    act(() => hook.result.current.handleRejectRequest(requestId));

    expect(hook.result.current.matchRequests[0].status).toBe('REJECTED');
    expect(hook.result.current.matchRequests[0].rejectedAt).not.toBeNull();
    expect(toasts).toContain('매칭 요청을 거절했어요');
  });
});

describe('useMainMatchingState — 매칭 해제', () => {
  it('매칭 해제 시 activeMatch가 null이 된다', () => {
    const { hook, toasts } = setup();

    act(() => hook.result.current.handleSendRequest('target-1'));
    act(() => hook.result.current.handleAcceptRequest(hook.result.current.matchRequests[0].id));
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
    act(() => hook.result.current.handleAcceptRequest(hook.result.current.matchRequests[0].id));
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
