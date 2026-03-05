'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getProfileCompletion } from '@/utils/profileCompletion';
import { BottomTabBar } from './components/BottomTabBar';
import { BuildingSelectModal } from './components/BuildingSelectModal';
import { DormitoryGuideSheet } from './components/DormitoryGuideSheet';
import { MatchCelebrationModal } from './components/MatchCelebrationModal';
import HomeTab from './tabs/HomeTab';
import RoommateListTab from './tabs/RoommateListTab';
import type { SortMode, ViewMode } from './tabs/RoommateListTab';
import ProfileTab from './tabs/ProfileTab';
import SettingsTab from './tabs/SettingsTab';
import { getDormitoryById, UNASSIGNED_ID } from '@/constants/dormitory';
import { TOAST_DURATION, GUIDE_DELAY } from '@/constants/ui';
import { CURRENT_SEASON, isSeasonActive } from '@/constants/season';
import { MATCH_POLICY } from '@/constants/match';
import { isRequestExpired } from '@/utils/matchRequest';
import { calcMatchScore } from '@/utils/matchScore';
import { mockRawProfiles } from '@/__fixtures__/profiles';
import { MOCK_REQUESTS, MOCK_ACTIVE_MATCH } from '@/__fixtures__/matching';
import { DEFAULT_FILTERS } from './components/BottomSheet';
import type { TabId, UserProfile } from '@/types/profile';
import type { BlockedUser, ReportReason } from '@/types/report';
import type { MatchRequest, ActiveMatch } from '@/types/match';

export type { TabId, UserProfile } from '@/types/profile';

export default function Main() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [toast, setToast] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [hasSeenGuide, setHasSeenGuide] = useState(false);
  const [user, setUser] = useState<UserProfile>({
    nickname: '곰두리',
    gender: 'M',
    dormitoryId: null,
    lifestyle: {
      smoker: 'NO',
      sleepHabit: 'NONE',
      indoorEating: 'OK',
      bedtime: '22_24',
      wakeTime: '06_08',
      noiseSensitivity: 'MID',
      cleanliness: 'HIGH',
      relationshipStyle: 'CLOSE',
    },
    intro: '조용하고 규칙적인 생활을 선호합니다. 서로 존중하며 지낼 룸메이트를 찾습니다.',
    messageToRoommate: null,
    additional: {
      college: null,
      grade: null,
      mbti: null,
      temperatureSensitivity: null,
    },
  });

  const handleSelectDormitory = useCallback(
    (dormitoryId: string) => {
      setUser((prev) => ({ ...prev, dormitoryId }));
      if (dormitoryId === UNASSIGNED_ID) {
        setToast('건물 미배정으로 설정했어요');
      } else {
        const dorm = getDormitoryById(dormitoryId);
        setToast(dorm ? `${dorm.name}(으)로 설정했어요` : '건물이 설정되었어요');
      }
      if (!hasSeenGuide) {
        setTimeout(() => setShowGuide(true), GUIDE_DELAY);
      }
    },
    [hasSeenGuide],
  );

  const handleCloseGuide = useCallback(() => {
    setShowGuide(false);
    setHasSeenGuide(true);
  }, []);

  const handleShowGuide = useCallback(() => {
    setShowGuide(true);
  }, []);

  const handleIntroChange = useCallback((intro: string) => {
    setUser((prev) => ({ ...prev, intro }));
    setToast('자기소개가 저장되었어요');
  }, []);

  const handleMessageChange = useCallback((msg: string | null) => {
    setUser((prev) => ({ ...prev, messageToRoommate: msg }));
    setToast('룸메에게 한마디가 저장되었어요');
  }, []);

  const handleLifestyleChange = useCallback((lifestyle: UserProfile['lifestyle']) => {
    setUser((prev) => ({ ...prev, lifestyle }));
    setToast('생활패턴이 저장되었어요');
  }, []);

  const handleAdditionalChange = useCallback((additional: UserProfile['additional']) => {
    setUser((prev) => ({ ...prev, additional }));
  }, []);

  // --- Profile 100% completion toast ---
  const hasShownCompletionToast = useRef(false);
  // NOTE: mock 기준. API 연동 시 초기 로딩 완료 후 wasCompleteOnMount를 재평가해야 함
  const wasCompleteOnMount = useRef(getProfileCompletion(user).isComplete);

  useEffect(() => {
    if (hasShownCompletionToast.current) return;
    if (wasCompleteOnMount.current) return;
    const { isComplete } = getProfileCompletion(user);
    if (isComplete) {
      setToast('프로필이 완성되었어요! \uD83C\uDF89');
      hasShownCompletionToast.current = true;
    }
  }, [user]);

  // --- Bookmark state ---
  const [bookmarkedUserIds, setBookmarkedUserIds] = useState<Set<string>>(new Set());

  const handleToggleBookmark = useCallback((userId: string) => {
    setBookmarkedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  // --- Block / Report state ---
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const blockedUserIds = useMemo(() => new Set(blockedUsers.map((u) => u.userId)), [blockedUsers]);
  const [reportedUserIds, setReportedUserIds] = useState<Set<string>>(new Set());

  const handleBlockUser = useCallback((userId: string, nickname: string) => {
    setBlockedUsers((prev) => {
      if (prev.some((u) => u.userId === userId)) return prev;
      return [...prev, { userId, nickname, blockedAt: new Date().toISOString() }];
    });
    setBookmarkedUserIds((prev) => {
      if (!prev.has(userId)) return prev;
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
    setToast(`${nickname}님을 차단했어요`);
  }, []);

  const handleUnblockUser = useCallback((userId: string, nickname: string) => {
    setToast(`${nickname}님의 차단을 해제했어요`);
    setBlockedUsers((prev) => prev.filter((u) => u.userId !== userId));
  }, []);

  const handleReportUser = useCallback(
    (userId: string, _reason: ReportReason, _detail: string | null) => {
      if (reportedUserIds.has(userId)) {
        setToast('이미 신고한 사용자예요');
        return;
      }
      setReportedUserIds((prev) => {
        const next = new Set(prev);
        next.add(userId);
        return next;
      });
      setToast('신고가 접수되었어요');
    },
    [reportedUserIds],
  );

  // --- Matching state ---
  const seasonActive = isSeasonActive(CURRENT_SEASON);
  const [matchRequests, setMatchRequests] = useState<MatchRequest[]>(
    seasonActive ? MOCK_REQUESTS : [],
  );
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(
    seasonActive ? MOCK_ACTIVE_MATCH : null,
  );
  const [showCelebration, setShowCelebration] = useState<{
    nickname: string;
    score: number;
  } | null>(null);

  const handleSendRequest = useCallback((targetUserId: string, message?: string | null) => {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setHours(expiresAt.getHours() + MATCH_POLICY.REQUEST_TTL_HOURS);

    const newRequest: MatchRequest = {
      id: `req-${Date.now()}`,
      fromUserId: 'me',
      toUserId: targetUserId,
      status: 'PENDING',
      message: message ?? null,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      rejectedAt: null,
    };
    setMatchRequests((prev) => [...prev, newRequest]);
    setToast('매칭 요청을 보냈어요');
  }, []);

  const handleCancelRequest = useCallback((requestId: string) => {
    setMatchRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: 'CANCELED' as const } : r)),
    );
    setToast('매칭 요청을 취소했어요');
  }, []);

  const handleAcceptRequest = useCallback(
    (requestId: string) => {
      const request = matchRequests.find((r) => r.id === requestId);
      if (!request) return;

      const partnerId = request.fromUserId;
      const partnerProfile = mockRawProfiles.find((p) => p.id === partnerId);

      // Set match as active
      const match: ActiveMatch = {
        matchId: `match-${Date.now()}`,
        partnerUserId: partnerId,
        partnerNickname: partnerProfile?.nickname ?? partnerId,
        partnerDormitoryId: partnerProfile?.dormitoryId ?? null,
        matchScore: partnerProfile ? calcMatchScore(user.lifestyle, partnerProfile.lifestyle) : 0,
        matchedAt: new Date().toISOString(),
      };
      setActiveMatch(match);

      // Update request statuses: accepted → ACTIVE, other PENDING → CANCELED
      setMatchRequests((prev) =>
        prev.map((r) => {
          if (r.id === requestId) return { ...r, status: 'ACTIVE' as const };
          if (r.status === 'PENDING' && !isRequestExpired(r))
            return { ...r, status: 'CANCELED' as const };
          return r;
        }),
      );

      // Show celebration
      setShowCelebration({
        nickname: match.partnerNickname,
        score: match.matchScore,
      });
    },
    [matchRequests, user.lifestyle],
  );

  const handleRejectRequest = useCallback((requestId: string) => {
    setMatchRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? { ...r, status: 'REJECTED' as const, rejectedAt: new Date().toISOString() }
          : r,
      ),
    );
    setToast('매칭 요청을 거절했어요');
  }, []);

  const handleEndMatch = useCallback(() => {
    setActiveMatch(null);
    setToast('매칭이 해제되었어요');
  }, []);

  // Derived counts
  const receivedPendingCount = useMemo(
    () =>
      matchRequests.filter(
        (r) => r.toUserId === 'me' && r.status === 'PENDING' && !isRequestExpired(r),
      ).length,
    [matchRequests],
  );

  // --- RoommateListTab lifted state (preserved across tab switches) ---
  const [listSortMode, setListSortMode] = useState<SortMode>('match');
  const [listFilters, setListFilters] = useState(DEFAULT_FILTERS);
  const [listViewMode, setListViewMode] = useState<ViewMode>('all');

  // 탭 전환 시 스크롤 최상단으로 이동
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), TOAST_DURATION);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <div className="min-h-screen bg-[var(--knu-background-alt)] pb-20">
      {user.dormitoryId === null && (
        <BuildingSelectModal gender={user.gender} onSelect={handleSelectDormitory} />
      )}
      {/* Conditional tab rendering */}
      <main>
        {activeTab === 'home' && (
          <HomeTab
            user={user}
            onNavigate={setActiveTab}
            onShowGuide={handleShowGuide}
            matchRequests={matchRequests}
            activeMatch={activeMatch}
            onCancelRequest={handleCancelRequest}
            onAcceptRequest={handleAcceptRequest}
            onRejectRequest={handleRejectRequest}
            onEndMatch={handleEndMatch}
            profiles={mockRawProfiles}
          />
        )}
        {activeTab === 'list' && (
          <RoommateListTab
            user={user}
            onNavigate={setActiveTab}
            profiles={mockRawProfiles}
            sortMode={listSortMode}
            onSortModeChange={setListSortMode}
            filters={listFilters}
            onFiltersChange={setListFilters}
            viewMode={listViewMode}
            onViewModeChange={setListViewMode}
            blockedUserIds={blockedUserIds}
            onBlock={handleBlockUser}
            onReport={handleReportUser}
            matchRequests={matchRequests}
            activeMatch={activeMatch}
            onSendRequest={handleSendRequest}
            bookmarkedUserIds={bookmarkedUserIds}
            onToggleBookmark={handleToggleBookmark}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileTab
            user={user}
            onDormitoryChange={handleSelectDormitory}
            onIntroChange={handleIntroChange}
            onMessageChange={handleMessageChange}
            onLifestyleChange={handleLifestyleChange}
            onAdditionalChange={handleAdditionalChange}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            onShowGuide={handleShowGuide}
            blockedUsers={blockedUsers}
            onUnblock={handleUnblockUser}
          />
        )}
      </main>

      <BottomTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        badges={receivedPendingCount > 0 ? { home: receivedPendingCount } : undefined}
      />

      {/* Dormitory Guide Sheet */}
      {showGuide && user.dormitoryId && (
        <DormitoryGuideSheet dormitoryId={user.dormitoryId} onClose={handleCloseGuide} />
      )}

      {/* Match Celebration Modal */}
      <MatchCelebrationModal
        isOpen={showCelebration !== null}
        onClose={() => setShowCelebration(null)}
        partnerNickname={showCelebration?.nickname ?? ''}
        matchScore={showCelebration?.score ?? 0}
      />

      {/* Toast */}
      {toast && (
        <div
          role="alert"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 bg-gray-900 text-white text-sm font-medium rounded-xl shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
