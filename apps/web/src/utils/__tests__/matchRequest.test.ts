import { describe, it, expect, vi, afterEach } from 'vitest';
import type { MatchRequest, ActiveMatch } from '@/types/match';
import { isRequestExpired, getPendingCount, getMatchButtonState } from '../matchRequest';
import { MATCH_POLICY } from '@/constants/match';

// ── 헬퍼 ──────────────────────────────────────────────────────────

const NOW = new Date('2026-03-01T12:00:00Z').getTime();

function makeRequest(overrides: Partial<MatchRequest> = {}): MatchRequest {
  return {
    id: 'req-1',
    fromUserId: 'me',
    toUserId: 'target',
    status: 'PENDING',
    message: null,
    createdAt: new Date(NOW - 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(NOW + 24 * 60 * 60 * 1000).toISOString(),
    rejectedAt: null,
    ...overrides,
  };
}

const defaultParams = () => ({
  currentUserId: 'me',
  targetUserId: 'target',
  targetDormitoryId: 'dorm-A' as string | null,
  userDormitoryId: 'dorm-A' as string | null,
  requests: [] as MatchRequest[],
  activeMatch: null as ActiveMatch | null,
  blockedUserIds: new Set<string>(),
  isSeasonMatching: true,
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── isRequestExpired ──────────────────────────────────────────────

describe('isRequestExpired', () => {
  it('만료 시각이 과거이면 true', () => {
    vi.setSystemTime(NOW);
    const req = makeRequest({ expiresAt: new Date(NOW - 1000).toISOString() });
    expect(isRequestExpired(req)).toBe(true);
  });

  it('만료 시각이 미래이면 false', () => {
    vi.setSystemTime(NOW);
    const req = makeRequest({ expiresAt: new Date(NOW + 1000).toISOString() });
    expect(isRequestExpired(req)).toBe(false);
  });

  it('만료 시각이 정확히 현재이면 true', () => {
    vi.setSystemTime(NOW);
    const req = makeRequest({ expiresAt: new Date(NOW).toISOString() });
    expect(isRequestExpired(req)).toBe(true);
  });

  it('expiresAt이 빈 문자열이면 만료 처리 (fail-close)', () => {
    const req = makeRequest({ expiresAt: '' });
    expect(isRequestExpired(req)).toBe(true);
  });

  it('expiresAt이 invalid date 문자열이면 만료 처리 (fail-close)', () => {
    const req = makeRequest({ expiresAt: 'not-a-date' });
    expect(isRequestExpired(req)).toBe(true);
  });
});

// ── getPendingCount ───────────────────────────────────────────────

describe('getPendingCount', () => {
  it('PENDING이면서 만료 안 된 요청만 카운트', () => {
    vi.setSystemTime(NOW);
    const requests = [
      makeRequest({ id: '1', status: 'PENDING', expiresAt: new Date(NOW + 1000).toISOString() }),
      makeRequest({ id: '2', status: 'PENDING', expiresAt: new Date(NOW - 1000).toISOString() }),
      makeRequest({ id: '3', status: 'REJECTED' }),
      makeRequest({ id: '4', status: 'PENDING', expiresAt: new Date(NOW + 2000).toISOString() }),
    ];
    expect(getPendingCount(requests)).toBe(2);
  });

  it('빈 배열이면 0', () => {
    expect(getPendingCount([])).toBe(0);
  });
});

// ── getMatchButtonState ───────────────────────────────────────────

describe('getMatchButtonState', () => {
  it('1. 차단된 유저 → BLOCKED', () => {
    const params = { ...defaultParams(), blockedUserIds: new Set(['target']) };
    expect(getMatchButtonState(params)).toEqual({ type: 'BLOCKED', label: '차단됨' });
  });

  it('2. 비시즌 → OFF_SEASON', () => {
    const params = { ...defaultParams(), isSeasonMatching: false };
    expect(getMatchButtonState(params)).toEqual({ type: 'OFF_SEASON', label: '시즌 종료' });
  });

  it('3. 다른 건물 → DIFFERENT_BUILDING', () => {
    const params = { ...defaultParams(), targetDormitoryId: 'dorm-B' };
    expect(getMatchButtonState(params)).toEqual({ type: 'DIFFERENT_BUILDING', label: '다른 건물' });
  });

  it('3-b. 건물 미배정(유저 null) → DIFFERENT_BUILDING 아님', () => {
    const params = { ...defaultParams(), userDormitoryId: null, targetDormitoryId: 'dorm-B' };
    expect(getMatchButtonState(params)).toEqual({ type: 'REQUEST', label: '매칭 요청' });
  });

  it('3-c. unassigned는 truthy이므로 호출부에서 null 정규화 필요', () => {
    const params = {
      ...defaultParams(),
      userDormitoryId: 'unassigned',
      targetDormitoryId: 'dorm-B',
    };
    expect(getMatchButtonState(params)).toEqual({ type: 'DIFFERENT_BUILDING', label: '다른 건물' });
  });

  it('3-d. 상대가 unassigned여도 동일하게 DIFFERENT_BUILDING 판정', () => {
    const params = { ...defaultParams(), targetDormitoryId: 'unassigned' };
    expect(getMatchButtonState(params)).toEqual({ type: 'DIFFERENT_BUILDING', label: '다른 건물' });
  });

  it('4. 이미 매칭 중 → MATCHED', () => {
    const activeMatch: ActiveMatch = {
      matchId: 'm-1',
      partnerUserId: 'someone',
      partnerNickname: '룸메',
      partnerDormitoryId: null,
      matchScore: 85,
      matchedAt: new Date().toISOString(),
    };
    const params = { ...defaultParams(), activeMatch };
    expect(getMatchButtonState(params)).toEqual({ type: 'MATCHED', label: '매칭됨' });
  });

  it('5. 보낸 PENDING 요청 → PENDING_SENT', () => {
    vi.setSystemTime(NOW);
    const req = makeRequest({ id: 'r-sent', fromUserId: 'me', toUserId: 'target' });
    const params = { ...defaultParams(), requests: [req] };
    const result = getMatchButtonState(params);
    expect(result.type).toBe('PENDING_SENT');
    if (result.type === 'PENDING_SENT') {
      expect(result.requestId).toBe('r-sent');
    }
  });

  it('6. 받은 PENDING 요청 → PENDING_RECEIVED', () => {
    vi.setSystemTime(NOW);
    const req = makeRequest({ id: 'r-recv', fromUserId: 'target', toUserId: 'me' });
    const params = { ...defaultParams(), requests: [req] };
    const result = getMatchButtonState(params);
    expect(result.type).toBe('PENDING_RECEIVED');
    if (result.type === 'PENDING_RECEIVED') {
      expect(result.requestId).toBe('r-recv');
    }
  });

  // ── 7. 재신청 차단 (AC 기반 TDD) ──────────────────────────────

  // AC-F1: 거절 후 같은 방향 영구 재신청 차단
  it('7-a. AC-F1: 거절 후 같은 방향 → SAME_DIRECTION_BLOCKED', () => {
    vi.setSystemTime(NOW);
    const req = makeRequest({
      id: 'r-rej',
      fromUserId: 'me',
      toUserId: 'target',
      status: 'REJECTED',
      rejectedAt: new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const params = { ...defaultParams(), requests: [req] };
    const result = getMatchButtonState(params);
    expect(result.type).toBe('SAME_DIRECTION_BLOCKED');
    expect(result).not.toHaveProperty('availableAt');
  });

  // AC-F2: 만료 후 같은 방향 영구 재신청 차단
  it('7-b. AC-F2: 만료 후 같은 방향 → SAME_DIRECTION_BLOCKED', () => {
    vi.setSystemTime(NOW);
    const req = makeRequest({
      id: 'r-exp',
      fromUserId: 'me',
      toUserId: 'target',
      status: 'EXPIRED',
      expiresAt: new Date(NOW - 1000).toISOString(),
    });
    const params = { ...defaultParams(), requests: [req] };
    const result = getMatchButtonState(params);
    expect(result.type).toBe('SAME_DIRECTION_BLOCKED');
  });

  // AC-F2 보강: status가 PENDING이지만 expiresAt이 과거 → 시간 만료로 간주하여 차단
  it('7-b2. AC-F2 보강: PENDING + 시간 만료 → SAME_DIRECTION_BLOCKED', () => {
    vi.setSystemTime(NOW);
    const req = makeRequest({
      id: 'r-pending-expired',
      fromUserId: 'me',
      toUserId: 'target',
      status: 'PENDING',
      expiresAt: new Date(NOW - 1000).toISOString(),
    });
    const params = { ...defaultParams(), requests: [req] };
    const result = getMatchButtonState(params);
    expect(result.type).toBe('SAME_DIRECTION_BLOCKED');
  });

  // AC-N1: 취소 후 같은 방향 재신청 허용 (3회 미만)
  it('7-c. AC-N1: 취소 후 같은 방향 재신청 허용 (시도 < 3)', () => {
    vi.setSystemTime(NOW);
    const req = makeRequest({
      id: 'r-can',
      fromUserId: 'me',
      toUserId: 'target',
      status: 'CANCELED',
    });
    const params = { ...defaultParams(), requests: [req] };
    expect(getMatchButtonState(params)).toEqual({ type: 'REQUEST', label: '매칭 요청' });
  });

  // AC-N1 보강: 취소된 요청은 시간이 지나도 차단되면 안 된다
  it('7-c2. AC-N1 보강: CANCELED + 시간 만료 → REQUEST (차단 아님)', () => {
    vi.setSystemTime(NOW);
    const req = makeRequest({
      id: 'r-can-expired',
      fromUserId: 'me',
      toUserId: 'target',
      status: 'CANCELED',
      expiresAt: new Date(NOW - 1000).toISOString(),
    });
    const params = { ...defaultParams(), requests: [req] };
    expect(getMatchButtonState(params)).toEqual({ type: 'REQUEST', label: '매칭 요청' });
  });

  // AC-N2: 거절/만료 후 역방향 신청 허용
  it('7-d. AC-N2: 거절 후 역방향 신청 허용', () => {
    vi.setSystemTime(NOW);
    // A→B가 거절됨 → B→A 방향에서 판단 (currentUserId='target', targetUserId='me')
    const req = makeRequest({
      id: 'r-rej',
      fromUserId: 'me',
      toUserId: 'target',
      status: 'REJECTED',
      rejectedAt: new Date(NOW - 1000).toISOString(),
    });
    const params = {
      ...defaultParams(),
      currentUserId: 'target',
      targetUserId: 'me',
      requests: [req],
    };
    expect(getMatchButtonState(params)).toEqual({ type: 'REQUEST', label: '매칭 요청' });
  });

  // AC-F3: 같은 방향 4번째 요청 차단 (취소 3회 소진)
  it('7-e. AC-F3: 취소 3회 소진 → ATTEMPTS_EXHAUSTED', () => {
    vi.setSystemTime(NOW);
    const requests = [1, 2, 3].map((i) =>
      makeRequest({
        id: `r-can-${i}`,
        fromUserId: 'me',
        toUserId: 'target',
        status: 'CANCELED',
      }),
    );
    const params = { ...defaultParams(), requests };
    const result = getMatchButtonState(params);
    expect(result.type).toBe('ATTEMPTS_EXHAUSTED');
  });

  // AC-B1: 3번째 같은 방향 요청은 허용 (경계)
  it('7-f. AC-B1: 취소 2회 후 3번째 요청 허용', () => {
    vi.setSystemTime(NOW);
    const requests = [1, 2].map((i) =>
      makeRequest({
        id: `r-can-${i}`,
        fromUserId: 'me',
        toUserId: 'target',
        status: 'CANCELED',
      }),
    );
    const params = { ...defaultParams(), requests };
    expect(getMatchButtonState(params)).toEqual({ type: 'REQUEST', label: '매칭 요청' });
  });

  // AC-B2: 방향별 시도 수 독립 카운팅
  it('7-g. AC-B2: A→B 3회 소진되어도 B→A는 허용', () => {
    vi.setSystemTime(NOW);
    // A(me)→B(target) 방향 3회 소진
    const forwardRequests = [1, 2, 3].map((i) =>
      makeRequest({
        id: `r-fwd-${i}`,
        fromUserId: 'me',
        toUserId: 'target',
        status: 'CANCELED',
      }),
    );
    // B→A 방향에서 판단 (currentUserId='target', targetUserId='me')
    const params = {
      ...defaultParams(),
      currentUserId: 'target',
      targetUserId: 'me',
      requests: forwardRequests,
    };
    expect(getMatchButtonState(params)).toEqual({ type: 'REQUEST', label: '매칭 요청' });
  });

  // AC-B3: 취소 누적 후 거절 발생 시 SAME_DIRECTION_BLOCKED 우선
  it('7-h. AC-B3: 취소 2회 + 거절 1회 → SAME_DIRECTION_BLOCKED 우선', () => {
    vi.setSystemTime(NOW);
    const requests = [
      makeRequest({ id: 'r-can-1', fromUserId: 'me', toUserId: 'target', status: 'CANCELED' }),
      makeRequest({ id: 'r-can-2', fromUserId: 'me', toUserId: 'target', status: 'CANCELED' }),
      makeRequest({
        id: 'r-rej-3',
        fromUserId: 'me',
        toUserId: 'target',
        status: 'REJECTED',
        rejectedAt: new Date(NOW - 1000).toISOString(),
      }),
    ];
    const params = { ...defaultParams(), requests };
    const result = getMatchButtonState(params);
    expect(result.type).toBe('SAME_DIRECTION_BLOCKED');
  });

  it('8-a. PENDING이 한도 미만이면 REQUEST', () => {
    vi.setSystemTime(NOW);
    const requests = Array.from({ length: MATCH_POLICY.MAX_PENDING_REQUESTS - 1 }, (_, i) =>
      makeRequest({
        id: `r-${i}`,
        toUserId: `other-${i}`,
        expiresAt: new Date(NOW + 24 * 60 * 60 * 1000).toISOString(),
      }),
    );
    const params = { ...defaultParams(), requests };
    expect(getMatchButtonState(params)).toEqual({ type: 'REQUEST', label: '매칭 요청' });
  });

  it('8-b. PENDING이 한도 이상이면 SLOT_FULL', () => {
    vi.setSystemTime(NOW);
    const requests = Array.from({ length: MATCH_POLICY.MAX_PENDING_REQUESTS }, (_, i) =>
      makeRequest({
        id: `r-${i}`,
        toUserId: `other-${i}`,
        expiresAt: new Date(NOW + 24 * 60 * 60 * 1000).toISOString(),
      }),
    );
    const params = { ...defaultParams(), requests };
    expect(getMatchButtonState(params)).toEqual({ type: 'SLOT_FULL', label: '요청 한도 초과' });
  });

  it('8-c. PENDING이 한도 초과여도 SLOT_FULL', () => {
    vi.setSystemTime(NOW);
    const requests = Array.from({ length: MATCH_POLICY.MAX_PENDING_REQUESTS + 1 }, (_, i) =>
      makeRequest({
        id: `r-${i}`,
        toUserId: `other-${i}`,
        expiresAt: new Date(NOW + 24 * 60 * 60 * 1000).toISOString(),
      }),
    );
    const params = { ...defaultParams(), requests };
    expect(getMatchButtonState(params)).toEqual({ type: 'SLOT_FULL', label: '요청 한도 초과' });
  });

  it('9. 그 외 → REQUEST', () => {
    const params = defaultParams();
    expect(getMatchButtonState(params)).toEqual({ type: 'REQUEST', label: '매칭 요청' });
  });

  it('우선순위: 차단 > 비시즌 (차단이 우선)', () => {
    const params = {
      ...defaultParams(),
      blockedUserIds: new Set(['target']),
      isSeasonMatching: false,
    };
    expect(getMatchButtonState(params).type).toBe('BLOCKED');
  });
});
