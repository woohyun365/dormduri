import { useState, useCallback, useMemo } from 'react';
import { CURRENT_SEASON, isSeasonActive } from '@/constants/season';
import { MATCH_POLICY } from '@/constants/match';
import { isRequestExpired } from '@/utils/matchRequest';
import { calcMatchScore } from '@/utils/matchScore';
import { mockRawProfiles } from '@/__fixtures__/profiles';
import { createMockRequests, MOCK_ACTIVE_MATCH } from '@/__fixtures__/matching';
import type { MatchRequest, ActiveMatch } from '@/types/match';
import type { UserProfile } from '@/types/profile';

let idCounter = 0;

export function useMainMatchingState(
  showToast: (msg: string) => void,
  userLifestyle: UserProfile['lifestyle'],
  currentUserId: string,
) {
  const seasonActive = isSeasonActive(CURRENT_SEASON);

  const [matchRequests, setMatchRequests] = useState<MatchRequest[]>(() =>
    seasonActive ? createMockRequests(currentUserId) : [],
  );
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(
    seasonActive ? MOCK_ACTIVE_MATCH : null,
  );
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
      };
      setMatchRequests((prev) => [...prev, newRequest]);
      showToast('매칭 요청을 보냈어요');
    },
    [showToast, currentUserId],
  );

  const handleCancelRequest = useCallback(
    (requestId: string) => {
      setMatchRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: 'CANCELED' as const } : r)),
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
      const partnerProfile = mockRawProfiles.find((p) => p.id === partnerId);

      const match: ActiveMatch = {
        matchId: `match-${++idCounter}`,
        partnerUserId: partnerId,
        partnerNickname: partnerProfile?.nickname ?? partnerId,
        partnerDormitoryId: partnerProfile?.dormitoryId ?? null,
        matchScore: partnerProfile ? calcMatchScore(userLifestyle, partnerProfile.lifestyle) : 0,
        matchedAt: new Date().toISOString(),
      };
      setActiveMatch(match);

      setMatchRequests((prev) =>
        prev.map((r) => {
          if (r.id === requestId) return { ...r, status: 'ACTIVE' as const };
          if (r.status === 'PENDING' && !isRequestExpired(r))
            return { ...r, status: 'CANCELED' as const };
          return r;
        }),
      );

      setShowCelebration({
        nickname: match.partnerNickname,
        score: match.matchScore,
      });
    },
    [matchRequests, userLifestyle],
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
