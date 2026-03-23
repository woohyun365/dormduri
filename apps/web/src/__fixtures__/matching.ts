import type { MatchRequest, ActiveMatch } from '@/types/match';

// ── mock 데이터 ────────────────────────────────────────────────────
// 정적 타임스탬프: SSR 안전 + 시간 경과에 무관하게 동작
// PENDING → 먼 미래(2099), REJECTED/EXPIRED → 먼 과거(2020)
// 매칭 요청 만료: 5일(120시간) — matching-lifecycle.md:93

/** 실제 로그인 사용자 ID를 주입하여 mock 요청 목록을 생성한다. */
export function createMockRequests(currentUserId: string): MatchRequest[] {
  return [
    // PENDING 보낸 요청 2건
    {
      id: 'req-001',
      fromUserId: currentUserId,
      toUserId: '1',
      status: 'PENDING',
      message: null,
      createdAt: '2099-01-01T00:00:00.000Z',
      expiresAt: '2099-01-03T00:00:00.000Z',
      rejectedAt: null,
    },
    {
      id: 'req-002',
      fromUserId: currentUserId,
      toUserId: '2',
      status: 'PENDING',
      message: '같이 룸메 해요!',
      createdAt: '2099-01-01T00:00:00.000Z',
      expiresAt: '2099-01-03T00:00:00.000Z',
      rejectedAt: null,
    },
    // PENDING 받은 요청 1건
    {
      id: 'req-003',
      fromUserId: '3',
      toUserId: currentUserId,
      status: 'PENDING',
      message: '생활 패턴이 비슷해서 요청드립니다',
      createdAt: '2099-01-01T00:00:00.000Z',
      expiresAt: '2099-01-03T00:00:00.000Z',
      rejectedAt: null,
    },
    // REJECTED 1건 (같은 방향 영구 차단 — 거절 이력이 있으므로 재신청 불가)
    {
      id: 'req-004',
      fromUserId: currentUserId,
      toUserId: '4',
      status: 'REJECTED',
      message: null,
      createdAt: '2099-01-01T00:00:00.000Z',
      expiresAt: '2099-01-03T00:00:00.000Z',
      rejectedAt: '2099-01-02T00:00:00.000Z',
    },
    // EXPIRED 1건
    {
      id: 'req-005',
      fromUserId: currentUserId,
      toUserId: '5',
      status: 'EXPIRED',
      message: null,
      createdAt: '2020-01-01T00:00:00.000Z',
      expiresAt: '2020-01-03T00:00:00.000Z',
      rejectedAt: null,
    },
  ];
}

// ActiveMatch mock — 아직 매칭 없음
export const MOCK_ACTIVE_MATCH: ActiveMatch | null = null;
