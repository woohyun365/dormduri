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
  isCampusOperated?: boolean;
  isSeasonMatching: boolean;
  isSeasonOpen?: boolean;
}

/** 5일(120시간) 경과 여부 (fail-close: invalid/empty expiresAt → 만료 처리) */
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
  isCampusOperated = true,
  isSeasonMatching,
  isSeasonOpen,
}: GetMatchButtonStateParams): MatchButtonState {
  // 1. 차단된 유저
  if (blockedUserIds.has(targetUserId)) {
    return { type: 'BLOCKED', label: '차단됨' };
  }

  // 2. 비운영 캠퍼스
  if (!isCampusOperated) {
    return { type: 'NOT_OPERATED', label: '서비스 준비 중' };
  }

  // 3. 비시즌 또는 시즌 오픈 (매칭 비활성)
  if (!isSeasonMatching) {
    if (isSeasonOpen) {
      return { type: 'SEASON_OPEN', label: '매칭 준비 중' };
    }
    return { type: 'OFF_SEASON', label: '비시즌' };
  }

  // 4. 다른 건물
  if (userDormitoryId && targetDormitoryId && userDormitoryId !== targetDormitoryId) {
    return { type: 'DIFFERENT_BUILDING', label: '다른 건물' };
  }

  // 5. 이미 매칭 중 (MATCHED)
  if (activeMatch) {
    return { type: 'MATCHED', label: '매칭됨' };
  }

  // 6. 대화 중 상대 (당사자 간에서만 — D-25 타인 비노출)
  const hasConversation = requests.some(
    (r) =>
      r.status === 'IN_CONVERSATION' &&
      ((r.fromUserId === currentUserId && r.toUserId === targetUserId) ||
        (r.fromUserId === targetUserId && r.toUserId === currentUserId)),
  );
  if (hasConversation) {
    return { type: 'IN_CONVERSATION', label: '대화 중' };
  }

  // 7. 대화 종료 조합 (조합 1회 — 양방향 재교류 불가)
  const hasConversationEnded = requests.some(
    (r) =>
      r.status === 'CONVERSATION_ENDED' &&
      ((r.fromUserId === currentUserId && r.toUserId === targetUserId) ||
        (r.fromUserId === targetUserId && r.toUserId === currentUserId)),
  );
  if (hasConversationEnded) {
    return { type: 'CONVERSATION_ENDED_PAIR', label: '대화 종료' };
  }

  // 8. 매칭 해제 조합 (조합 1회 — 양방향 재교류 불가)
  const hasUnmatched = requests.some(
    (r) =>
      r.status === 'UNMATCHED' &&
      ((r.fromUserId === currentUserId && r.toUserId === targetUserId) ||
        (r.fromUserId === targetUserId && r.toUserId === currentUserId)),
  );
  if (hasUnmatched) {
    return { type: 'UNMATCHED_PAIR', label: '매칭 해제됨' };
  }

  // 9. 상대에게 보낸 PENDING 요청
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

  // 10. 상대에게서 받은 PENDING 요청
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

  // 11. 재신청 차단: 같은 방향 기준
  const sameDirectionRequests = requests.filter(
    (r) => r.fromUserId === currentUserId && r.toUserId === targetUserId,
  );

  // 11a. 거절/만료 → 같은 방향 영구 차단
  const hasRejectedOrExpired = sameDirectionRequests.some(
    (r) =>
      r.status === 'REJECTED' ||
      r.status === 'EXPIRED' ||
      (r.status === 'PENDING' && isRequestExpired(r)),
  );
  if (hasRejectedOrExpired) {
    return { type: 'SAME_DIRECTION_BLOCKED', label: '재요청 불가' };
  }

  // 11b. 같은 방향 시도 수 3회 이상 → 차단
  if (sameDirectionRequests.length >= MATCH_POLICY.MAX_DIRECTION_ATTEMPTS) {
    return { type: 'ATTEMPTS_EXHAUSTED', label: '요청 횟수 초과' };
  }

  // 12. 보낸 PENDING 3개 이상 (동시 발신 3건 제한 — matching-lifecycle.md:131)
  const sentPendingCount = requests.filter(
    (r) => r.fromUserId === currentUserId && r.status === 'PENDING' && !isRequestExpired(r),
  ).length;
  if (sentPendingCount >= MATCH_POLICY.MAX_PENDING_REQUESTS) {
    return { type: 'SLOT_FULL', label: '요청 한도 초과' };
  }

  // 13. 그 외
  return { type: 'REQUEST', label: '매칭 요청' };
}
