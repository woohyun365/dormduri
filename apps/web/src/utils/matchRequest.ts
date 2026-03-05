import type { MatchRequest, ActiveMatch, MatchButtonState } from '@/types/match';
import { MATCH_POLICY } from '@/constants/match';

interface GetMatchButtonStateParams {
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

/** 거절 쿨다운 종료 일시 (rejectedAt + 7일) */
export function getRejectionCooldownEnd(request: MatchRequest): string {
  if (!request.rejectedAt) return new Date().toISOString();
  const end = new Date(request.rejectedAt);
  end.setDate(end.getDate() + MATCH_POLICY.REJECTION_COOLDOWN_DAYS);
  return end.toISOString();
}

/** 현재 PENDING 요청 수 (만료되지 않은 것만) */
export function getPendingCount(requests: MatchRequest[]): number {
  return requests.filter((r) => r.status === 'PENDING' && !isRequestExpired(r)).length;
}

/** 상대 유저에 대한 버튼 상태를 판단 */
export function getMatchButtonState({
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

  // 7. 거절당한 뒤 7일 미경과
  const rejectedByTarget =
    requests
      .filter(
        (r) => r.toUserId === targetUserId && r.status === 'REJECTED' && r.rejectedAt !== null,
      )
      .sort((a, b) => new Date(b.rejectedAt!).getTime() - new Date(a.rejectedAt!).getTime())[0] ??
    null;
  if (rejectedByTarget) {
    const cooldownEnd = getRejectionCooldownEnd(rejectedByTarget);
    if (new Date(cooldownEnd).getTime() > Date.now()) {
      const daysLeft = Math.ceil(
        (new Date(cooldownEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      return {
        type: 'REJECTED_COOLDOWN',
        label: `${daysLeft}일 후 재요청 가능`,
        availableAt: cooldownEnd,
      };
    }
  }

  // 8. PENDING 5개 이상
  if (getPendingCount(requests) >= MATCH_POLICY.MAX_PENDING_REQUESTS) {
    return { type: 'SLOT_FULL', label: '요청 한도 초과' };
  }

  // 9. 그 외
  return { type: 'REQUEST', label: '매칭 요청' };
}
