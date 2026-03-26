import { useState, useCallback, useMemo } from 'react';
import { MATCH_POLICY } from '@/constants/match';
import { isRequestExpired } from '@/utils/matchRequest';
import { calcMatchScoreWithGating } from '@/utils/matchScore';
import type { MatchRequest, ActiveMatch } from '@/types/match';
import type { RoommateProfile, UserProfile } from '@/types/profile';

let idCounter = 0;

export function useMainMatchingState(
  showToast: (msg: string) => void,
  userLifestyle: UserProfile['lifestyle'],
  currentUserId: string,
  seasonActive: boolean,
  profiles: Omit<RoommateProfile, 'matchScore'>[],
  initialRequests: MatchRequest[],
  initialActiveMatch: ActiveMatch | null,
) {
  const [matchRequests, setMatchRequests] = useState<MatchRequest[]>(initialRequests);
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(initialActiveMatch);
  const [showCelebration, setShowCelebration] = useState<{
    nickname: string;
    score: number;
  } | null>(null);

  const handleSendRequest = useCallback(
    (targetUserId: string, message?: string | null) => {
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setHours(expiresAt.getHours() + MATCH_POLICY.REQUEST_TTL_HOURS);

      const newRequest: MatchRequest = {
        id: `req-${++idCounter}`,
        fromUserId: currentUserId,
        toUserId: targetUserId,
        status: 'PENDING',
        message: message ?? null,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        rejectedAt: null,
        acceptedAt: null,
        resolvedAt: null,
      };
      setMatchRequests((prev) => [...prev, newRequest]);
      showToast('매칭 요청을 보냈어요');
    },
    [showToast, currentUserId],
  );

  const handleCancelRequest = useCallback(
    (requestId: string) => {
      const now = new Date().toISOString();
      setMatchRequests((prev) =>
        prev.map((r) =>
          r.id === requestId ? { ...r, status: 'CANCELLED' as const, resolvedAt: now } : r,
        ),
      );
      showToast('매칭 요청을 취소했어요');
    },
    [showToast],
  );

  // PENDING → IN_CONVERSATION (수락 — 아직 매칭 확정 아님)
  const handleAcceptRequest = useCallback(
    (requestId: string) => {
      const now = new Date().toISOString();
      setMatchRequests((prev) =>
        prev.map((r) =>
          r.id === requestId ? { ...r, status: 'IN_CONVERSATION' as const, acceptedAt: now } : r,
        ),
      );
      showToast('요청을 수락했어요. 대화를 시작하세요!');
    },
    [showToast],
  );

  // IN_CONVERSATION → ACTIVE (매칭 확정)
  const handleConfirmMatch = useCallback(
    (requestId: string) => {
      const request = matchRequests.find((r) => r.id === requestId);
      if (!request || request.status !== 'IN_CONVERSATION') return;

      const partnerId =
        request.fromUserId === currentUserId ? request.toUserId : request.fromUserId;
      const partnerProfile = profiles.find((p) => p.id === partnerId);

      const scoreResult = partnerProfile
        ? calcMatchScoreWithGating(userLifestyle, partnerProfile.lifestyle)
        : { score: null, type: 'gated' as const };

      const match: ActiveMatch = {
        matchId: `match-${++idCounter}`,
        partnerUserId: partnerId,
        partnerNickname: partnerProfile?.nickname ?? partnerId,
        partnerDormitoryId: partnerProfile?.dormitoryId ?? null,
        matchScore: scoreResult.score ?? 0,
        scoreType: scoreResult.type,
        matchedAt: new Date().toISOString(),
        cancelRequestedAt: null,
        cancelRequestedBy: null,
      };
      setActiveMatch(match);

      // 확정된 요청 → ACTIVE, 나머지 PENDING/IN_CONVERSATION → CANCELLED
      setMatchRequests((prev) =>
        prev.map((r) => {
          if (r.id === requestId) return { ...r, status: 'ACTIVE' as const };
          if (r.status === 'PENDING' && !isRequestExpired(r))
            return { ...r, status: 'CANCELLED' as const, resolvedAt: new Date().toISOString() };
          if (r.status === 'IN_CONVERSATION' && r.id !== requestId)
            return {
              ...r,
              status: 'CONVERSATION_ENDED' as const,
              resolvedAt: new Date().toISOString(),
            };
          return r;
        }),
      );

      setShowCelebration({
        nickname: match.partnerNickname,
        score: match.matchScore,
      });
    },
    [matchRequests, userLifestyle, profiles, currentUserId],
  );

  // IN_CONVERSATION → CONVERSATION_ENDED (대화 종료)
  const handleEndConversation = useCallback(
    (requestId: string) => {
      const now = new Date().toISOString();
      setMatchRequests((prev) =>
        prev.map((r) =>
          r.id === requestId ? { ...r, status: 'CONVERSATION_ENDED' as const, resolvedAt: now } : r,
        ),
      );
      showToast('대화를 종료했어요');
    },
    [showToast],
  );

  const handleRejectRequest = useCallback(
    (requestId: string) => {
      const now = new Date().toISOString();
      setMatchRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? { ...r, status: 'REJECTED' as const, rejectedAt: now, resolvedAt: now }
            : r,
        ),
      );
      showToast('매칭 요청을 거절했어요');
    },
    [showToast],
  );

  // ACTIVE → UNMATCHED (매칭 해제)
  const handleEndMatch = useCallback(() => {
    if (!activeMatch) return;
    const now = new Date().toISOString();

    // ACTIVE 요청을 UNMATCHED로 전이
    setMatchRequests((prev) =>
      prev.map((r) =>
        r.status === 'ACTIVE' ? { ...r, status: 'UNMATCHED' as const, resolvedAt: now } : r,
      ),
    );
    setActiveMatch(null);
    showToast('매칭이 해제되었어요');
  }, [showToast, activeMatch]);

  const receivedPendingCount = useMemo(
    () =>
      matchRequests.filter(
        (r) => r.toUserId === currentUserId && r.status === 'PENDING' && !isRequestExpired(r),
      ).length,
    [matchRequests, currentUserId],
  );

  return {
    seasonActive,
    matchRequests,
    activeMatch,
    showCelebration,
    closeCelebration: () => setShowCelebration(null),
    handleSendRequest,
    handleCancelRequest,
    handleAcceptRequest,
    handleConfirmMatch,
    handleEndConversation,
    handleRejectRequest,
    handleEndMatch,
    receivedPendingCount,
  };
}
