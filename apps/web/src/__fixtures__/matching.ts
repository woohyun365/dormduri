import type { MatchRequest, ActiveMatch } from '@/types/match';

// ── mock 데이터 ────────────────────────────────────────────────────
// 정적 타임스탬프: SSR 안전 + 시간 경과에 무관하게 동작
// PENDING → 먼 미래(2099), REJECTED/EXPIRED → 먼 과거(2020)

// PENDING 보낸 요청 2건
export const MOCK_SENT_PENDING_1: MatchRequest = {
  id: 'req-001',
  fromUserId: 'me',
  toUserId: '1',
  status: 'PENDING',
  message: null,
  createdAt: '2099-01-01T00:00:00.000Z',
  expiresAt: '2099-01-03T00:00:00.000Z',
  rejectedAt: null,
};

export const MOCK_SENT_PENDING_2: MatchRequest = {
  id: 'req-002',
  fromUserId: 'me',
  toUserId: '2',
  status: 'PENDING',
  message: '같이 룸메 해요!',
  createdAt: '2099-01-01T00:00:00.000Z',
  expiresAt: '2099-01-03T00:00:00.000Z',
  rejectedAt: null,
};

// PENDING 받은 요청 1건
export const MOCK_RECEIVED_PENDING: MatchRequest = {
  id: 'req-003',
  fromUserId: '3',
  toUserId: 'me',
  status: 'PENDING',
  message: '생활 패턴이 비슷해서 요청드립니다',
  createdAt: '2099-01-01T00:00:00.000Z',
  expiresAt: '2099-01-03T00:00:00.000Z',
  rejectedAt: null,
};

// REJECTED 1건 (쿨다운 진행 중 — 먼 미래 거절이므로 항상 쿨다운 중)
export const MOCK_REJECTED: MatchRequest = {
  id: 'req-004',
  fromUserId: 'me',
  toUserId: '4',
  status: 'REJECTED',
  message: null,
  createdAt: '2099-01-01T00:00:00.000Z',
  expiresAt: '2099-01-03T00:00:00.000Z',
  rejectedAt: '2099-01-02T00:00:00.000Z',
};

// EXPIRED 1건
export const MOCK_EXPIRED: MatchRequest = {
  id: 'req-005',
  fromUserId: 'me',
  toUserId: '5',
  status: 'EXPIRED',
  message: null,
  createdAt: '2020-01-01T00:00:00.000Z',
  expiresAt: '2020-01-03T00:00:00.000Z',
  rejectedAt: null,
};

// 모든 mock 요청 (SSR 안전 — 정적 문자열만 사용)
export const MOCK_REQUESTS: MatchRequest[] = [
  MOCK_SENT_PENDING_1,
  MOCK_SENT_PENDING_2,
  MOCK_RECEIVED_PENDING,
  MOCK_REJECTED,
  MOCK_EXPIRED,
];

// ActiveMatch mock — 아직 매칭 없음
export const MOCK_ACTIVE_MATCH: ActiveMatch | null = null;
