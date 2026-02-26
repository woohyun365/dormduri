import type { MatchRequest, ActiveMatch } from '@/types/match';

// ── 기존 export (HomeTab.tsx 호환성 유지) ──────────────────────────
export type MatchingStatus = 'none' | 'pending' | 'matched';

export const MATCHING: {
  status: MatchingStatus;
  sentCount: number;
  receivedCount: number;
  matchedNickname: string | null;
} = {
  status: 'none',
  sentCount: 0,
  receivedCount: 0,
  matchedNickname: null,
};

// ── 새 mock 데이터 ─────────────────────────────────────────────────

const now = new Date();

function hoursFromNow(h: number): string {
  const d = new Date(now);
  d.setHours(d.getHours() + h);
  return d.toISOString();
}

function daysAgo(d: number): string {
  const date = new Date(now);
  date.setDate(date.getDate() - d);
  return date.toISOString();
}

// PENDING 보낸 요청 2건
export const MOCK_SENT_PENDING_1: MatchRequest = {
  id: 'req-001',
  fromUserId: 'me',
  toUserId: 'user-a',
  status: 'PENDING',
  message: null,
  createdAt: daysAgo(1),
  expiresAt: hoursFromNow(24),
  rejectedAt: null,
};

export const MOCK_SENT_PENDING_2: MatchRequest = {
  id: 'req-002',
  fromUserId: 'me',
  toUserId: 'user-b',
  status: 'PENDING',
  message: '같이 룸메 해요!',
  createdAt: hoursFromNow(-44),
  expiresAt: hoursFromNow(4),
  rejectedAt: null,
};

// PENDING 받은 요청 1건
export const MOCK_RECEIVED_PENDING: MatchRequest = {
  id: 'req-003',
  fromUserId: 'user-c',
  toUserId: 'me',
  status: 'PENDING',
  message: '생활 패턴이 비슷해서 요청드립니다',
  createdAt: daysAgo(0),
  expiresAt: hoursFromNow(48),
  rejectedAt: null,
};

// REJECTED 1건 (쿨다운 진행 중 — 3일 전 거절됨)
export const MOCK_REJECTED: MatchRequest = {
  id: 'req-004',
  fromUserId: 'me',
  toUserId: 'user-d',
  status: 'REJECTED',
  message: null,
  createdAt: daysAgo(5),
  expiresAt: daysAgo(3),
  rejectedAt: daysAgo(3),
};

// EXPIRED 1건
export const MOCK_EXPIRED: MatchRequest = {
  id: 'req-005',
  fromUserId: 'me',
  toUserId: 'user-e',
  status: 'EXPIRED',
  message: null,
  createdAt: daysAgo(4),
  expiresAt: daysAgo(2),
  rejectedAt: null,
};

// 모든 mock 요청
export const MOCK_REQUESTS: MatchRequest[] = [
  MOCK_SENT_PENDING_1,
  MOCK_SENT_PENDING_2,
  MOCK_RECEIVED_PENDING,
  MOCK_REJECTED,
  MOCK_EXPIRED,
];

// ActiveMatch mock — 아직 매칭 없음
export const MOCK_ACTIVE_MATCH: ActiveMatch | null = null;
