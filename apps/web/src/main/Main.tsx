'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { toast } from 'sonner';
import { BottomTabBar } from './components/BottomTabBar';
import { BuildingSelectModal } from './components/BuildingSelectModal';
import { DormitoryGuideSheet } from './components/DormitoryGuideSheet';
import { MatchCelebrationModal } from './components/MatchCelebrationModal';
import HomeTab from './tabs/home/HomeTab';
import RoommateListTab from './tabs/roommate-list/RoommateListTab';
import ProfileTab from './tabs/profile/ProfileTab';
import MatchingTab from './tabs/matching/MatchingTab';
import ChatTab from './tabs/chat/ChatTab';
import { HomeTabSkeleton } from '@/components/Skeleton';
import { HomeDashboardErrorState } from './tabs/home/components/HomeDashboardErrorState';
import { AppShellSkeleton } from '@/components/AppShellSkeleton';
import { MatchingTabSkeleton } from './tabs/matching/MatchingTabSkeleton';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { useMainProfileState } from './hooks/useMainProfileState';
import { useMainSocialState } from './hooks/useMainSocialState';
import { useMainMatchingState } from './hooks/useMainMatchingState';
import { useMainListViewState } from './hooks/useMainListViewState';
import { useMainHomeDashboard } from './hooks/useMainHomeDashboard';
import { UNASSIGNED_ID, isCampusOperated } from '@/constants/dormitory';
import { profileApi } from '@/api/profile';
import { seasonApi } from '@/api/season';
import { homeApi } from '@/api/home';
import { SeasonProvider } from '@/contexts/SeasonContext';
import { getMainFeatureFlags } from './utils/mainFeatureFlags';
import { getMainTabDocumentTitle } from './utils/mainTabTitle';
import { toHomeSeasonContext } from './tabs/home/model/homeDashboardViewModel';
import type { Season } from '@/constants/season';
import type { SeasonState } from '@/types/season';
import type { TabId, UserProfile, RoommateProfile, MatchingNavOptions } from '@/types/profile';
import type { PastSeasonData } from '@/types/match';

export type { TabId, UserProfile } from '@/types/profile';

/** 서비스 레이어에서 로드하는 데이터 */
interface MainData {
  profiles: Omit<RoommateProfile, 'matchScore'>[];
  pastSeasons: PastSeasonData[];
  season: Season;
  isOpen: boolean;
  isMatching: boolean;
  daysUntilEnd: number;
  seasonState: SeasonState;
}

function MainContent({ initialUser }: { initialUser: UserProfile }) {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window === 'undefined') return 'home';
    const saved = sessionStorage.getItem('activeTab');
    if (saved && ['home', 'list', 'matching', 'chat', 'profile'].includes(saved)) {
      return saved as TabId;
    }
    return 'home';
  });
  const [data, setData] = useState<MainData | null>(null);
  const homeDashboard = useMainHomeDashboard();

  const showToast = useCallback((msg: string) => toast(msg), []);

  // 매칭 탭 서브탭 네비게이트 옵션
  const [matchingNavOptions, setMatchingNavOptions] = useState<MatchingNavOptions>({});

  const handleNavigate = useCallback((tab: TabId, options?: MatchingNavOptions) => {
    setMatchingNavOptions(tab === 'matching' && options ? options : {});
    setActiveTab(tab);
  }, []);

  // --- Onboarding ---
  const { hasSeenGuide, markGuideSeen, resetChecklist, hasSeenTooltip, markTooltipSeen } =
    useOnboardingState(initialUser.nickname);

  // --- Domain hooks ---
  const profileState = useMainProfileState(initialUser, {
    showToast,
    hasSeenGuide,
    markGuideSeen,
  });

  // 건물 선택 후 재조회를 위해 현재 dormitoryId 추적
  const currentDormitoryId = profileState.user.dormitoryId;

  // --- 서비스 레이어 데이터 로딩 ---
  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 시즌 먼저 로드 → 시즌 상태에 따라 profileApi에 dormitoryId 전달 결정
      const seasonResult = await seasonApi.getCurrentSeason();
      if (cancelled) return;

      const season = seasonResult ?? {
        season: {
          name: '',
          roomSelectionDate: '',
        },
        state: 'OFF_SEASON' as const,
        isOpen: false,
        isMatching: false,
        daysUntilEnd: 0,
      };

      // SEASON_OPEN + SEASON_MATCHING → 동일 건물 격리
      // UNASSIGNED → 빈 배열 (정책: 건물 미선택 유저는 탐색 불가)
      // 건물 통계와 matching 요약은 Home dashboard/API owner가 제공한다.
      const isUnassignedId = currentDormitoryId === UNASSIGNED_ID;
      const dormitoryIdForFilter =
        season.isOpen || season.isMatching ? (isUnassignedId ? null : currentDormitoryId) : null;

      const profileResult =
        (season.isOpen || season.isMatching) && isUnassignedId
          ? []
          : await profileApi.getProfiles(
              initialUser.campus,
              initialUser.gender,
              dormitoryIdForFilter,
            );

      const pastSeasons = await homeApi.getPastSeasons();

      if (cancelled) return;

      setData({
        profiles: profileResult,
        pastSeasons,
        season: season.season,
        isOpen: season.isOpen,
        isMatching: season.isMatching,
        daysUntilEnd: season.daysUntilEnd,
        seasonState: season.state,
      });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [currentDormitoryId, initialUser.campus, initialUser.gender, profileState.user]);

  const socialState = useMainSocialState(showToast);

  const matchingState = useMainMatchingState(showToast, profileState.user, data?.profiles ?? []);

  const listViewState = useMainListViewState();

  // 탭 전환 시 스크롤 최상단 + sessionStorage 저장
  useEffect(() => {
    window.scrollTo(0, 0);
    sessionStorage.setItem('activeTab', activeTab);
    document.title = getMainTabDocumentTitle(activeTab);
  }, [activeTab]);

  // 데이터 로딩 중 — 탭바 먼저 표시 + 탭별 스켈레톤
  if (!data) {
    return (
      <div className="min-h-screen bg-[var(--knu-background-alt)] pb-20">
        {activeTab === 'home' && <HomeTabSkeleton />}
        {activeTab === 'matching' && <MatchingTabSkeleton />}
        {activeTab !== 'home' && activeTab !== 'matching' && <AppShellSkeleton />}
        <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  const fallbackSeasonContext = {
    season: data.season,
    state: data.seasonState,
    isOpen: data.isOpen,
    isMatching: data.isMatching,
    daysUntilEnd: data.daysUntilEnd,
  };
  const seasonContextValue = toHomeSeasonContext(homeDashboard.dashboard, fallbackSeasonContext);
  const campusOperated =
    homeDashboard.dashboard?.viewer.campusOperated ?? isCampusOperated(profileState.user.campus);
  const featureFlags = getMainFeatureFlags({
    campusOperated,
    isOpen: seasonContextValue.isOpen,
    isMatching: seasonContextValue.isMatching,
  });

  return (
    <SeasonProvider value={seasonContextValue}>
      <div className="min-h-screen bg-[var(--knu-background-alt)] pb-20">
        {campusOperated &&
          (seasonContextValue.isOpen || seasonContextValue.isMatching) &&
          profileState.showBuildingSelect && (
            <BuildingSelectModal
              campus={profileState.user.campus}
              gender={profileState.user.gender}
              onSelect={(dormitoryId) => {
                profileState.handleSelectDormitory(dormitoryId);
                profileState.setShowBuildingSelect(false);
              }}
            />
          )}
        {/* Conditional tab rendering */}
        <main>
          {activeTab === 'home' && (
            <>
              {homeDashboard.loading && <HomeTabSkeleton />}
              {!homeDashboard.loading && homeDashboard.error && (
                <HomeDashboardErrorState
                  message={homeDashboard.error}
                  refreshing={homeDashboard.refreshing}
                  onRetry={homeDashboard.refetch}
                />
              )}
              {!homeDashboard.loading && !homeDashboard.error && homeDashboard.dashboard && (
                <HomeTab
                  user={profileState.user}
                  dashboard={homeDashboard.dashboard}
                  onNavigate={handleNavigate}
                  onOpenBuildingSelect={() => profileState.setShowBuildingSelect(true)}
                  onDashboardRefresh={homeDashboard.refetch}
                />
              )}
            </>
          )}
          {activeTab === 'list' && (
            <RoommateListTab
              user={profileState.user}
              onNavigate={setActiveTab}
              profiles={data.profiles}
              sortMode={listViewState.sortMode}
              onSortModeChange={listViewState.setSortMode}
              filters={listViewState.filters}
              onFiltersChange={listViewState.setFilters}
              viewMode={listViewState.viewMode}
              onViewModeChange={listViewState.setViewMode}
              isCampusOperated={campusOperated}
              blockedUserIds={socialState.blockedUserIds}
              onBlock={socialState.handleBlockUser}
              onReport={socialState.handleReportUser}
              matchRequests={matchingState.matchRequests}
              activeMatch={matchingState.activeMatch}
              onSendRequest={
                featureFlags.canSendMatchRequest ? matchingState.handleSendRequest : undefined
              }
              bookmarkedUserIds={socialState.bookmarkedUserIds}
              onToggleBookmark={
                featureFlags.canToggleBookmark ? socialState.handleToggleBookmark : undefined
              }
              showProfileBanner={listViewState.showProfileBanner}
              onDismissProfileBanner={listViewState.dismissProfileBanner}
              showMatchScoreTip={!hasSeenTooltip('matchScore')}
              onDismissMatchScoreTip={() => markTooltipSeen('matchScore')}
              showMatchRequestTip={!hasSeenTooltip('matchRequest')}
              onDismissMatchRequestTip={() => markTooltipSeen('matchRequest')}
            />
          )}
          {activeTab === 'matching' && (
            <MatchingTab
              user={profileState.user}
              matchRequests={matchingState.matchRequests}
              activeMatch={matchingState.activeMatch}
              profiles={data.profiles}
              pastSeasons={data.pastSeasons}
              onCancelRequest={matchingState.handleCancelRequest}
              onAcceptRequest={matchingState.handleAcceptRequest}
              onRejectRequest={matchingState.handleRejectRequest}
              onConfirmMatch={matchingState.handleConfirmMatch}
              onRevokeConfirmMatch={matchingState.handleRevokeConfirmMatch}
              onFinalizePairGroup={matchingState.handleFinalizePairGroup}
              onEndConversation={matchingState.handleEndConversation}
              onEndMatch={matchingState.handleEndMatch}
              onNavigate={setActiveTab}
              initialSection={matchingNavOptions.section}
              initialRequestTab={matchingNavOptions.requestTab}
            />
          )}
          {activeTab === 'profile' && (
            <ProfileTab
              user={profileState.user}
              onDormitoryChange={profileState.handleSelectDormitory}
              onIntroChange={profileState.handleIntroChange}
              onMessageChange={profileState.handleMessageChange}
              onLifestyleChange={profileState.handleLifestyleChange}
              onAdditionalChange={profileState.handleAdditionalChange}
              onShowGuide={profileState.handleShowGuide}
              onResetChecklist={resetChecklist}
              blockedUsers={socialState.blockedUsers}
              onUnblock={socialState.handleUnblockUser}
            />
          )}
          {activeTab === 'chat' && (
            <ChatTab
              user={profileState.user}
              profiles={data.profiles}
              matchRequests={matchingState.matchRequests}
              activeMatch={matchingState.activeMatch}
              blockedUserIds={socialState.blockedUserIds}
              onBlock={socialState.handleBlockUser}
              onReport={socialState.handleReportUser}
              onConfirmMatch={matchingState.handleConfirmMatch}
              onRevokeConfirmMatch={matchingState.handleRevokeConfirmMatch}
              onEndConversation={matchingState.handleEndConversation}
              onEndMatch={matchingState.handleEndMatch}
              onNavigate={handleNavigate}
            />
          )}
        </main>

        <BottomTabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          badges={
            matchingState.receivedPendingCount > 0
              ? { matching: matchingState.receivedPendingCount }
              : undefined
          }
          disabledTabs={featureFlags.disabledTabs}
        />

        {/* Dormitory Guide Sheet */}
        {profileState.showGuide && profileState.user.dormitoryId && (
          <DormitoryGuideSheet
            dormitoryId={profileState.user.dormitoryId}
            onClose={profileState.handleCloseGuide}
          />
        )}

        {/* Match Celebration Modal */}
        <MatchCelebrationModal
          isOpen={matchingState.showCelebration !== null}
          onClose={matchingState.closeCelebration}
          partnerNickname={matchingState.showCelebration?.nickname ?? ''}
          matchScore={matchingState.showCelebration?.score ?? 0}
          kind={matchingState.showCelebration?.kind ?? 'pair'}
        />
      </div>
    </SeasonProvider>
  );
}

export default function Main({ initialUser }: { initialUser: UserProfile }) {
  return (
    <Suspense fallback={null}>
      <MainContent initialUser={initialUser} />
    </Suspense>
  );
}
