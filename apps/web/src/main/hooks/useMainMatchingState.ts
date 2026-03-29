/**
 * 매칭 상태 관리 hook — thin layer.
 * matchingApi 호출 → setState → toast. 상태 전이 로직은 mock-matching-service에 위임.
 * Sprint 7: matchingApi 내부가 HTTP로 교체되어도 이 hook은 변경 없음.
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { matchingApi } from '@/api/matching';
import { isRequestExpired } from '@/utils/matchRequest';
import type { MatchRequest, ActiveMatch } from '@/types/match';
import type { RoommateProfile, UserProfile } from '@/types/profile';

export function useMainMatchingState(
  showToast: (msg: string) => void,
  currentUserId: string,
  userLifestyle: UserProfile['lifestyle'],
  profiles: Omit<RoommateProfile, 'matchScore'>[],
) {
  const [matchRequests, setMatchRequests] = useState<MatchRequest[]>([]);
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(null);
  const [showCelebration, setShowCelebration] = useState<{
    nickname: string;
    score: number;
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
      const result = await matchingApi.sendRequest(currentUserId, targetUserId, message ?? null);
      setMatchRequests(result.requests);
      setActiveMatch(result.activeMatch);
      showToast('매칭 요청을 보냈어요');
    },
    [showToast, currentUserId],
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
      showToast('요청을 수락했어요. 대화를 시작하세요!');
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
        profiles,
        userLifestyle,
      });
      setMatchRequests(result.requests);
      setActiveMatch(result.activeMatch);
      if (result.activeMatch) {
        setShowCelebration({
          nickname: result.activeMatch.partnerNickname,
          score: result.activeMatch.matchScore,
        });
      }
    },
    [currentUserId, profiles, userLifestyle],
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
    const result = await matchingApi.endMatch(currentUserId);
    setMatchRequests(result.requests);
    setActiveMatch(result.activeMatch);
    showToast('매칭이 해제되었어요');
  }, [showToast, currentUserId]);

  const receivedPendingCount = useMemo(
    () =>
      matchRequests.filter(
        (r) => r.toUserId === currentUserId && r.status === 'PENDING' && !isRequestExpired(r),
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
    handleEndConversation,
    handleEndMatch,
    receivedPendingCount,
    refresh,
  };
}
