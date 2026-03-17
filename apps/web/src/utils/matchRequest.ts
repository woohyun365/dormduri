import type { MatchRequest, ActiveMatch, MatchButtonState } from '@/types/match';
import { MATCH_POLICY } from '@/constants/match';

interface GetMatchButtonStateParams {
  currentUserId: string;
  targetUserId: string;
  targetDormitoryId: string | null;
  userDormitoryId: string | null;
  requests: MatchRequest[];
  activeMatch: ActiveMatch | null;
  blockedUserIds: Set<string>;
  isSeasonActive: boolean;
}

/** 48h 경과 여부 (fail-close: invalid/empty expiresAt → 만료 처리) */
export function isRequestExpired(request: MatchRequest): boolean {
  if (!request.expiresAt) return true;
  const date = new Date(request.expiresAt);
  if (!Number.isFinite(date.getTime())) return true;
  return date.getTime() <= Date.now();
}

/** 현재 PENDING 요청 수 (만료되지 않은 것만) */
export function getPendingCount(requests: MatchRequest[]): number {
  return requests.filter((r) => r.status === 'PENDING' && !isRequestExpired(r)).length;
}

/** 상대 유저에 대한 버튼 상태를 판단 */
export function getMatchButtonState({
  currentUserId,
  targetUserId,
  targetDormitoryId,
  userDormitoryId,
  requests,
  activeMatch,
  blockedUserIds,
  isSeasonActive,
}: GetMatchButtonStateParams): MatchButtonState {
  // 1. 차단된 유저
  if (blockedUserIds.has(targetUserId)) {
    return { type: 'BLOCKED', label: '차단됨' };
  }

  // 2. 비시즌
  if (!isSeasonActive) {
    return { type: 'OFF_SEASON', label: '시즌 종료' };
  }

  // 3. 다른 건물
  if (userDormitoryId && targetDormitoryId && userDormitoryId !== targetDormitoryId) {
    return { type: 'DIFFERENT_BUILDING', label: '다른 건물' };
  }

  // 4. 이미 매칭 중 (MATCHED)
  if (activeMatch) {
    return { type: 'MATCHED', label: '매칭됨' };
  }

  // 5. 상대에게 보낸 PENDING 요청
  const sentPending = requests.find(
    (r) => r.toUserId === targetUserId && r.status === 'PENDING' && !isRequestExpired(r),
  );
  if (sentPending) {
    return {
      type: 'PENDING_SENT',
      label: '요청 대기 중',
      requestId: sentPending.id,
      expiresAt: sentPending.expiresAt,
    };
  }

  // 6. 상대에게서 받은 PENDING 요청
  const receivedPending = requests.find(
    (r) => r.fromUserId === targetUserId && r.status === 'PENDING' && !isRequestExpired(r),
  );
  if (receivedPending) {
    return {
      type: 'PENDING_RECEIVED',
      label: '수락 대기 중',
      requestId: receivedPending.id,
      expiresAt: receivedPending.expiresAt,
    };
  }

  // 7. 재신청 차단: 같은 방향 기준
  const sameDirectionRequests = requests.filter(
    (r) => r.fromUserId === currentUserId && r.toUserId === targetUserId,
  );

  // 7a. 거절/만료 → 같은 방향 영구 차단
  const hasRejectedOrExpired = sameDirectionRequests.some(
    (r) => r.status === 'REJECTED' || r.status === 'EXPIRED' || isRequestExpired(r),
  );
  if (hasRejectedOrExpired) {
    return { type: 'SAME_DIRECTION_BLOCKED', label: '재요청 불가' };
  }

  // 7b. 같은 방향 시도 수 3회 이상 → 차단
  if (sameDirectionRequests.length >= MATCH_POLICY.MAX_DIRECTION_ATTEMPTS) {
    return { type: 'ATTEMPTS_EXHAUSTED', label: '요청 횟수 초과' };
  }

  // 8. PENDING 3개 이상
  if (getPendingCount(requests) >= MATCH_POLICY.MAX_PENDING_REQUESTS) {
    return { type: 'SLOT_FULL', label: '요청 한도 초과' };
  }

  // 9. 그 외
  return { type: 'REQUEST', label: '매칭 요청' };
}
