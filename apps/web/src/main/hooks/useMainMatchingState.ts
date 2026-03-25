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
      setMatchRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: 'CANCELLED' as const } : r)),
      );
      showToast('매칭 요청을 취소했어요');
    },
    [showToast],
  );

  const handleAcceptRequest = useCallback(
    (requestId: string) => {
      const request = matchRequests.find((r) => r.id === requestId);
      if (!request) return;

      const partnerId = request.fromUserId;
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

      setMatchRequests((prev) =>
        prev.map((r) => {
          if (r.id === requestId) return { ...r, status: 'ACTIVE' as const };
          if (r.status === 'PENDING' && !isRequestExpired(r))
            return { ...r, status: 'CANCELLED' as const };
          return r;
        }),
      );

      setShowCelebration({
        nickname: match.partnerNickname,
        score: match.matchScore,
      });
    },
    [matchRequests, userLifestyle, profiles],
  );

  const handleRejectRequest = useCallback(
    (requestId: string) => {
      setMatchRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? { ...r, status: 'REJECTED' as const, rejectedAt: new Date().toISOString() }
            : r,
        ),
      );
      showToast('매칭 요청을 거절했어요');
    },
    [showToast],
  );

  const handleEndMatch = useCallback(() => {
    setActiveMatch(null);
    showToast('매칭이 해제되었어요');
  }, [showToast]);

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
    handleRejectRequest,
    handleEndMatch,
    receivedPendingCount,
  };
}
