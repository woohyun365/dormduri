import type { MatchRequest, ActiveMatch } from '@/types/match';

// ── mock 데이터 ────────────────────────────────────────────────────
// Hydration 안전: 모듈 스코프에서 Date를 호출하지 않고, 함수 호출 시점에 계산

function hoursFromNow(h: number): string {
  const d = new Date();
  d.setHours(d.getHours() + h);
  return d.toISOString();
}

function daysAgo(d: number): string {
  const date = new Date();
  date.setDate(date.getDate() - d);
  return date.toISOString();
}

function createMockRequests(): MatchRequest[] {
  // PENDING 보낸 요청 2건
  const sentPending1: MatchRequest = {
    id: 'req-001',
    fromUserId: 'me',
    toUserId: '1',
    status: 'PENDING',
    message: null,
    createdAt: daysAgo(1),
    expiresAt: hoursFromNow(24),
    rejectedAt: null,
  };

  const sentPending2: MatchRequest = {
    id: 'req-002',
    fromUserId: 'me',
    toUserId: '2',
    status: 'PENDING',
    message: '같이 룸메 해요!',
    createdAt: hoursFromNow(-44),
    expiresAt: hoursFromNow(4),
    rejectedAt: null,
  };

  // PENDING 받은 요청 1건
  const receivedPending: MatchRequest = {
    id: 'req-003',
    fromUserId: '3',
    toUserId: 'me',
    status: 'PENDING',
    message: '생활 패턴이 비슷해서 요청드립니다',
    createdAt: daysAgo(0),
    expiresAt: hoursFromNow(48),
    rejectedAt: null,
  };

  // REJECTED 1건 (쿨다운 진행 중 — 3일 전 거절됨)
  const rejected: MatchRequest = {
    id: 'req-004',
    fromUserId: 'me',
    toUserId: '4',
    status: 'REJECTED',
    message: null,
    createdAt: daysAgo(5),
    expiresAt: daysAgo(3),
    rejectedAt: daysAgo(3),
  };

  // EXPIRED 1건
  const expired: MatchRequest = {
    id: 'req-005',
    fromUserId: 'me',
    toUserId: '5',
    status: 'EXPIRED',
    message: null,
    createdAt: daysAgo(4),
    expiresAt: daysAgo(2),
    rejectedAt: null,
  };

  return [sentPending1, sentPending2, receivedPending, rejected, expired];
}

// 개별 export (테스트 호환)
export const MOCK_SENT_PENDING_1: MatchRequest = {
  id: 'req-001',
  fromUserId: 'me',
  toUserId: '1',
  status: 'PENDING',
  message: null,
  createdAt: '2026-02-26T00:00:00.000Z',
  expiresAt: '2026-02-28T12:00:00.000Z',
  rejectedAt: null,
};

export const MOCK_SENT_PENDING_2: MatchRequest = {
  id: 'req-002',
  fromUserId: 'me',
  toUserId: '2',
  status: 'PENDING',
  message: '같이 룸메 해요!',
  createdAt: '2026-02-25T20:00:00.000Z',
  expiresAt: '2026-02-28T04:00:00.000Z',
  rejectedAt: null,
};

export const MOCK_RECEIVED_PENDING: MatchRequest = {
  id: 'req-003',
  fromUserId: '3',
  toUserId: 'me',
  status: 'PENDING',
  message: '생활 패턴이 비슷해서 요청드립니다',
  createdAt: '2026-02-27T00:00:00.000Z',
  expiresAt: '2026-03-01T00:00:00.000Z',
  rejectedAt: null,
};

export const MOCK_REJECTED: MatchRequest = {
  id: 'req-004',
  fromUserId: 'me',
  toUserId: '4',
  status: 'REJECTED',
  message: null,
  createdAt: '2026-02-22T00:00:00.000Z',
  expiresAt: '2026-02-24T00:00:00.000Z',
  rejectedAt: '2026-02-24T00:00:00.000Z',
};

export const MOCK_EXPIRED: MatchRequest = {
  id: 'req-005',
  fromUserId: 'me',
  toUserId: '5',
  status: 'EXPIRED',
  message: null,
  createdAt: '2026-02-23T00:00:00.000Z',
  expiresAt: '2026-02-25T00:00:00.000Z',
  rejectedAt: null,
};

// 런타임 mock: 현재 시각 기준 동적 날짜 (클라이언트에서만 호출)
export function createMockMatchRequests(): MatchRequest[] {
  return createMockRequests();
}

// 정적 mock: 테스트/개별 참조용 (SSR 안전)
export const MOCK_REQUESTS: MatchRequest[] = [
  MOCK_SENT_PENDING_1,
  MOCK_SENT_PENDING_2,
  MOCK_RECEIVED_PENDING,
  MOCK_REJECTED,
  MOCK_EXPIRED,
];

// ActiveMatch mock — 아직 매칭 없음
export const MOCK_ACTIVE_MATCH: ActiveMatch | null = null;
