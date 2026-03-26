'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { BottomTabBar } from './components/BottomTabBar';
import { BuildingSelectModal } from './components/BuildingSelectModal';
import { DormitoryGuideSheet } from './components/DormitoryGuideSheet';
import { MatchCelebrationModal } from './components/MatchCelebrationModal';
import HomeTab from './tabs/home/HomeTab';
import RoommateListTab from './tabs/roommate-list/RoommateListTab';
import ProfileTab from './tabs/profile/ProfileTab';
import MatchingTab from './tabs/matching/MatchingTab';
import SettingsTab from './tabs/SettingsTab';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { useMainProfileState } from './hooks/useMainProfileState';
import { useMainSocialState } from './hooks/useMainSocialState';
import { useMainMatchingState } from './hooks/useMainMatchingState';
import { useMainListViewState } from './hooks/useMainListViewState';
import { buildMainBuildingStats } from './utils/buildMainBuildingStats';
import { UNASSIGNED_ID } from '@/constants/dormitory';
import { profileApi } from '@/api/profile';
import { seasonApi } from '@/api/season';
import { SeasonProvider } from '@/contexts/SeasonContext';
import { TOAST_DURATION } from '@/constants/ui';
import type { Season } from '@/constants/season';
import type { SeasonState } from '@/types/season';
import type { TabId, UserProfile, RoommateProfile } from '@/types/profile';

export type { TabId, UserProfile } from '@/types/profile';

/** 서비스 레이어에서 로드하는 데이터 */
interface MainData {
  profiles: Omit<RoommateProfile, 'matchScore'>[];
  season: Season;
  isOpen: boolean;
  isMatching: boolean;
  daysUntilEnd: number;
  seasonState: SeasonState;
}

function MainContent({ initialUser }: { initialUser: UserProfile }) {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [toast, setToast] = useState<string | null>(null);
  const [data, setData] = useState<MainData | null>(null);

  const showToast = useCallback((msg: string) => setToast(msg), []);

  // --- Onboarding ---
  const {
    hasSeenGuide,
    markGuideSeen,
    isChecklistDismissed,
    forceShowChecklist,
    dismissChecklist,
    resetChecklist,
    hasSeenTooltip,
    markTooltipSeen,
  } = useOnboardingState(initialUser.nickname);

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

      if (cancelled) return;

      setData({
        profiles: profileResult,
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
  }, [initialUser.campus, initialUser.gender, currentDormitoryId]);

  const socialState = useMainSocialState(showToast);

  const matchingState = useMainMatchingState(
    showToast,
    profileState.user.id,
    profileState.user.lifestyle,
    data?.profiles ?? [],
  );

  const listViewState = useMainListViewState();

  // --- Derived ---
  const buildingStats = useMemo(
    () => (data ? buildMainBuildingStats(profileState.user, data.profiles) : undefined),
    [profileState.user, data],
  );

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

  // 데이터 로딩 중
  if (!data) {
    return (
      <div className="min-h-screen bg-[var(--knu-background-alt)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[var(--knu-primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-[var(--knu-text-secondary)]">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const seasonContextValue = {
    season: data.season,
    state: data.seasonState,
    isOpen: data.isOpen,
    isMatching: data.isMatching,
    daysUntilEnd: data.daysUntilEnd,
  };

  return (
    <SeasonProvider value={seasonContextValue}>
      <div className="min-h-screen bg-[var(--knu-background-alt)] pb-20">
        {(data.isOpen || data.isMatching) &&
          (profileState.user.dormitoryId === null || profileState.showBuildingSelect) && (
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
            <HomeTab
              user={profileState.user}
              onNavigate={setActiveTab}
              onShowGuide={profileState.handleShowGuide}
              profiles={data.profiles}
              buildingStats={buildingStats}
              bookmarkedUserIds={socialState.bookmarkedUserIds}
              isChecklistDismissed={isChecklistDismissed}
              forceShowChecklist={forceShowChecklist}
              onDismissChecklist={dismissChecklist}
              onOpenBuildingSelect={() => profileState.setShowBuildingSelect(true)}
            />
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
              blockedUserIds={socialState.blockedUserIds}
              onBlock={socialState.handleBlockUser}
              onReport={socialState.handleReportUser}
              matchRequests={matchingState.matchRequests}
              activeMatch={matchingState.activeMatch}
              onSendRequest={data.isMatching ? matchingState.handleSendRequest : undefined}
              bookmarkedUserIds={socialState.bookmarkedUserIds}
              onToggleBookmark={
                data.isOpen || data.isMatching ? socialState.handleToggleBookmark : undefined
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
              onCancelRequest={matchingState.handleCancelRequest}
              onAcceptRequest={matchingState.handleAcceptRequest}
              onRejectRequest={matchingState.handleRejectRequest}
              onConfirmMatch={matchingState.handleConfirmMatch}
              onEndConversation={matchingState.handleEndConversation}
              onEndMatch={matchingState.handleEndMatch}
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
            />
          )}
          {activeTab === 'settings' && (
            <SettingsTab
              onShowGuide={profileState.handleShowGuide}
              onResetChecklist={() => {
                resetChecklist();
                showToast('홈 탭에서 시작 가이드를 확인하세요');
              }}
              blockedUsers={socialState.blockedUsers}
              onUnblock={socialState.handleUnblockUser}
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
