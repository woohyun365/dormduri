/**
 * 매칭 상태 관리 hook — thin layer.
 * matchingApi 호출 → setState → toast. 상태 전이 로직은 mock-matching-service에 위임.
 * Sprint 7: matchingApi 내부가 HTTP로 교체되어도 이 hook은 변경 없음.
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { matchingApi } from '@/api/matching';
import { doesRequestTargetUser, isRequestExpired } from '@/utils/matchRequest';
import type { MatchRequest, ActiveMatch } from '@/types/match';
import type { RoommateProfile, UserProfile } from '@/types/profile';

function shouldCelebrate(activeMatch: ActiveMatch | null): boolean {
  if (!activeMatch) return false;
  if (activeMatch.kind !== 'group') return true;
  return activeMatch.groupStage === 'PAIR_FINAL' || activeMatch.groupStage === 'GROUP_FINAL';
}

export function useMainMatchingState(
  showToast: (msg: string) => void,
  currentUser: Pick<UserProfile, 'id' | 'nickname' | 'dormitoryId' | 'lifestyle'>,
  profiles: Omit<RoommateProfile, 'matchScore'>[],
) {
  const currentUserId = currentUser.id;
  const userLifestyle = currentUser.lifestyle;
  const [matchRequests, setMatchRequests] = useState<MatchRequest[]>([]);
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(null);
  const [showCelebration, setShowCelebration] = useState<{
    nickname: string;
    score: number;
    kind: 'pair' | 'pair_final' | 'group_final';
  } | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // --- Initial load from API ---
  const refresh = useCallback(async () => {
    const result = await matchingApi.getState(currentUserId);
    setMatchRequests(result.requests);
    setActiveMatch(result.activeMatch);
  }, [currentUserId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setIsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // --- Actions (delegate to API, update state from response) ---

  const handleSendRequest = useCallback(
    async (targetUserId: string, message?: string | null) => {
      const previousCount = matchRequests.length;
      const result = await matchingApi.sendRequest(currentUserId, targetUserId, message ?? null);
      setMatchRequests(result.requests);
      setActiveMatch(result.activeMatch);
      if (result.requests.length > previousCount) {
        showToast('매칭 요청을 보냈어요');
      } else {
        showToast('현재 상태에서는 새 요청을 보낼 수 없어요');
      }
    },
    [showToast, currentUserId, matchRequests.length],
  );

  const handleCancelRequest = useCallback(
    async (requestId: string) => {
      const result = await matchingApi.cancelRequest(requestId, currentUserId);
      setMatchRequests(result.requests);
      setActiveMatch(result.activeMatch);
      showToast('매칭 요청을 취소했어요');
    },
    [showToast, currentUserId],
  );

  const handleAcceptRequest = useCallback(
    async (requestId: string) => {
      const result = await matchingApi.acceptRequest(requestId, currentUserId);
      setMatchRequests(result.requests);
      setActiveMatch(result.activeMatch);
      const updated = result.requests.find((request) => request.id === requestId);
      if (updated?.requestKind === 'GROUP_JOIN' && updated.status === 'PENDING') {
        showToast('합류 승인 의사가 기록됐어요. 다른 코어 멤버 승인 후 대화가 열립니다.');
      } else {
        showToast('요청을 수락했어요. 대화를 시작하세요!');
      }
    },
    [showToast, currentUserId],
  );

  const handleRejectRequest = useCallback(
    async (requestId: string) => {
      const result = await matchingApi.rejectRequest(requestId, currentUserId);
      setMatchRequests(result.requests);
      setActiveMatch(result.activeMatch);
      showToast('매칭 요청을 거절했어요');
    },
    [showToast, currentUserId],
  );

  const handleConfirmMatch = useCallback(
    async (requestId: string) => {
      const result = await matchingApi.confirmMatch(requestId, currentUserId, {
        currentUser: {
          id: currentUser.id,
          nickname: currentUser.nickname,
          dormitoryId: currentUser.dormitoryId,
        },
        profiles,
        userLifestyle,
      });
      setMatchRequests(result.requests);
      setActiveMatch(result.activeMatch);
      const celebratedMatch = result.activeMatch;
      if (celebratedMatch && shouldCelebrate(celebratedMatch)) {
        setShowCelebration({
          nickname: celebratedMatch.partnerNickname,
          score: celebratedMatch.matchScore,
          kind:
            celebratedMatch.kind === 'group'
              ? celebratedMatch.groupStage === 'GROUP_FINAL'
                ? 'group_final'
                : 'pair_final'
              : 'pair',
        });
      } else {
        showToast('내 확정이 기록됐어요. 상대가 확정하면 최종 적용됩니다.');
      }
    },
    [currentUser, currentUserId, profiles, showToast, userLifestyle],
  );

  const handleFinalizePairGroup = useCallback(async () => {
    const result = await matchingApi.finalizePairGroup(currentUserId);
    setMatchRequests(result.requests);
    setActiveMatch(result.activeMatch);
    const celebratedMatch = result.activeMatch;
    if (celebratedMatch && shouldCelebrate(celebratedMatch)) {
      setShowCelebration({
        nickname: celebratedMatch.partnerNickname,
        score: celebratedMatch.matchScore,
        kind: 'pair_final',
      });
    }
    showToast('2인으로 그룹을 마감했어요');
  }, [currentUserId, showToast]);

  const handleRevokeConfirmMatch = useCallback(
    async (requestId: string) => {
      const result = await matchingApi.revokeConfirmMatch(requestId, currentUserId);
      setMatchRequests(result.requests);
      setActiveMatch(result.activeMatch);
      showToast('확정 완료를 취소했어요');
    },
    [currentUserId, showToast],
  );

  const handleEndConversation = useCallback(
    async (requestId: string) => {
      const result = await matchingApi.endConversation(requestId, currentUserId);
      setMatchRequests(result.requests);
      setActiveMatch(result.activeMatch);
      showToast('대화를 종료했어요');
    },
    [showToast, currentUserId],
  );

  const handleEndMatch = useCallback(async () => {
    const before = activeMatch;
    const result = await matchingApi.endMatch(currentUserId);
    setMatchRequests(result.requests);
    setActiveMatch(result.activeMatch);

    if (before?.cancelRequestedAt && result.activeMatch && !result.activeMatch.cancelRequestedAt) {
      showToast(
        before.cancelRequestKind === 'CANDIDATE_LEAVE'
          ? '이탈 요청을 철회했어요'
          : '취소 요청을 철회했어요',
      );
    } else if (result.activeMatch?.cancelRequestedAt) {
      showToast(
        result.activeMatch.cancelRequestKind === 'CANDIDATE_LEAVE'
          ? result.activeMatch.cancelRequestedBy === currentUserId
            ? '그룹 이탈 요청이 기록됐어요. 코어 승인 후 복원됩니다.'
            : '후보 이탈 승인 의사가 기록됐어요.'
          : '매칭 취소 요청이 기록됐어요. 상대 승인 후 해제됩니다.',
      );
    } else {
      showToast('매칭이 해제되었어요');
    }
  }, [showToast, currentUserId, activeMatch]);

  const receivedPendingCount = useMemo(
    () =>
      matchRequests.filter(
        (r) =>
          doesRequestTargetUser(r, currentUserId) && r.status === 'PENDING' && !isRequestExpired(r),
      ).length,
    [matchRequests, currentUserId],
  );

  return {
    matchRequests,
    activeMatch,
    isLoaded,
    showCelebration,
    closeCelebration: () => setShowCelebration(null),
    handleSendRequest,
    handleCancelRequest,
    handleAcceptRequest,
    handleRejectRequest,
    handleConfirmMatch,
    handleRevokeConfirmMatch,
    handleFinalizePairGroup,
    handleEndConversation,
    handleEndMatch,
    receivedPendingCount,
    refresh,
  };
}
