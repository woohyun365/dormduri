import { describe, it, expect, vi, afterEach } from 'vitest';
import type { MatchRequest, ActiveMatch } from '@/types/match';
import {
  isRequestExpired,
  getRejectionCooldownEnd,
  getPendingCount,
  getMatchButtonState,
} from '../matchRequest';

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
  targetUserId: 'target',
  targetDormitoryId: 'dorm-A' as string | null,
  userDormitoryId: 'dorm-A' as string | null,
  requests: [] as MatchRequest[],
  activeMatch: null as ActiveMatch | null,
  blockedUserIds: new Set<string>(),
  isSeasonActive: true,
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
});

// ── getRejectionCooldownEnd ───────────────────────────────────────

describe('getRejectionCooldownEnd', () => {
  it('rejectedAt + 7일을 반환', () => {
    const rejectedAt = new Date('2026-03-01T00:00:00Z');
    const req = makeRequest({ rejectedAt: rejectedAt.toISOString() });
    const result = new Date(getRejectionCooldownEnd(req));
    expect(result.toISOString()).toBe('2026-03-08T00:00:00.000Z');
  });

  it('rejectedAt이 null이면 현재 시각 기준 반환', () => {
    vi.setSystemTime(NOW);
    const req = makeRequest({ rejectedAt: null });
    const result = new Date(getRejectionCooldownEnd(req));
    expect(result.getTime()).toBe(NOW);
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
    const params = { ...defaultParams(), isSeasonActive: false };
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

  it('7. 거절 쿨다운 중 → REJECTED_COOLDOWN', () => {
    vi.setSystemTime(NOW);
    const req = makeRequest({
      status: 'REJECTED',
      toUserId: 'target',
      rejectedAt: new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3일 전 거절
    });
    const params = { ...defaultParams(), requests: [req] };
    const result = getMatchButtonState(params);
    expect(result.type).toBe('REJECTED_COOLDOWN');
    if (result.type === 'REJECTED_COOLDOWN') {
      expect(result.label).toContain('일 후 재요청 가능');
    }
  });

  it('7-b. 거절 쿨다운 만료 → REQUEST', () => {
    vi.setSystemTime(NOW);
    const req = makeRequest({
      status: 'REJECTED',
      toUserId: 'target',
      rejectedAt: new Date(NOW - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10일 전 거절
    });
    const params = { ...defaultParams(), requests: [req] };
    expect(getMatchButtonState(params)).toEqual({ type: 'REQUEST', label: '매칭 요청' });
  });

  it('8. PENDING 5개 이상 → SLOT_FULL', () => {
    vi.setSystemTime(NOW);
    const requests = Array.from({ length: 5 }, (_, i) =>
      makeRequest({
        id: `r-${i}`,
        toUserId: `other-${i}`, // target이 아닌 다른 유저에게 보낸 요청
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
      isSeasonActive: false,
    };
    expect(getMatchButtonState(params).type).toBe('BLOCKED');
  });
});
