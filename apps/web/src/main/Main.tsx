'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
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
import { useMainLocalOnboardingState } from '@/main/hooks/useMainLocalOnboardingState';
import { useMainProfileState } from './hooks/useMainProfileState';
import { useMainSocialState } from './hooks/useMainSocialState';
import { useMainMatchingState } from './hooks/useMainMatchingState';
import { useMainListViewState } from './hooks/useMainListViewState';
import {
  useMainHomeDashboard,
  type UseMainHomeDashboardResult,
} from './hooks/useMainHomeDashboard';
import { seasonParticipationApi } from './api/season-participation.api';
import { useMainLegacyTabData } from './hooks/useMainLegacyTabData';
import { SeasonProvider } from '@/main/contexts/SeasonContext';
import { getMainFeatureFlags } from './utils/mainFeatureFlags';
import { getMainTabDocumentTitle } from './utils/mainTabTitle';
import { toMainSeasonContext, toMainLegacyUserProfile } from './utils/mainDashboardAdapters';
import { getDormitoryById, UNASSIGNED_ID } from '@/constants/dormitory';
import type { MatchingNavOptions, TabId } from '@/types/profile';
import type { HomeDashboardResponse } from '@repo/shared/home';

export type { TabId } from '@/types/profile';

const LEGACY_DATA_TABS = new Set<TabId>(['list', 'matching', 'chat']);

function MainShellFrame({
  activeTab,
  onTabChange,
  children,
}: {
  activeTab: TabId;
  onTabChange: Dispatch<SetStateAction<TabId>>;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-(--knu-background-alt) pb-20">
      {children}
      <BottomTabBar activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}

function MainLegacyDataErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      role="alert"
      className="mx-auto mt-16 w-[calc(100%-2rem)] max-w-md rounded-3xl border border-(--knu-border) bg-white p-6 text-center shadow-sm"
    >
      <p className="text-sm font-semibold text-(--knu-primary)">탭 정보를 불러오지 못했어요</p>
      <p className="mt-2 text-sm leading-6 text-(--knu-text-secondary)">
        잠시 후 다시 시도하거나 다른 탭을 이용해주세요.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-2xl bg-(--knu-primary) px-4 py-3 text-sm font-semibold text-white transition hover:bg-(--knu-primary-dark)"
      >
        다시 시도
      </button>
    </section>
  );
}

function MainInitialContent({
  activeTab,
  onTabChange,
  homeDashboard,
}: {
  activeTab: TabId;
  onTabChange: Dispatch<SetStateAction<TabId>>;
  homeDashboard: UseMainHomeDashboardResult;
}) {
  if (homeDashboard.loading || !homeDashboard.dashboard) {
    if (homeDashboard.error) {
      return (
        <MainShellFrame activeTab={activeTab} onTabChange={onTabChange}>
          <HomeDashboardErrorState
            message={homeDashboard.error}
            refreshing={homeDashboard.refreshing}
            onRetry={homeDashboard.refetch}
          />
        </MainShellFrame>
      );
    }

    return (
      <MainShellFrame activeTab={activeTab} onTabChange={onTabChange}>
        {activeTab === 'matching' ? <MatchingTabSkeleton /> : <HomeTabSkeleton />}
      </MainShellFrame>
    );
  }

  return (
    <MainDashboardContent
      activeTab={activeTab}
      onTabChange={onTabChange}
      dashboard={homeDashboard.dashboard}
      homeDashboard={homeDashboard}
    />
  );
}

function MainDashboardContent({
  activeTab,
  onTabChange,
  dashboard,
  homeDashboard,
}: {
  activeTab: TabId;
  onTabChange: Dispatch<SetStateAction<TabId>>;
  dashboard: HomeDashboardResponse;
  homeDashboard: UseMainHomeDashboardResult;
}) {
  const [matchingNavOptions, setMatchingNavOptions] = useState<MatchingNavOptions>({});
  const handleNavigate = useCallback(
    (tab: TabId, options?: MatchingNavOptions) => {
      setMatchingNavOptions(tab === 'matching' && options ? options : {});
      onTabChange(tab);
    },
    [onTabChange],
  );
  const seasonContextValue = toMainSeasonContext(dashboard);
  const campusOperated = dashboard.viewer.campusOperated;
  const featureFlags = getMainFeatureFlags({
    campusOperated,
    isOpen: seasonContextValue.isOpen,
    isMatching: seasonContextValue.isMatching,
  });

  if (activeTab === 'home') {
    return (
      <MainHomeDashboardContent
        activeTab={activeTab}
        dashboard={dashboard}
        homeDashboard={homeDashboard}
        onNavigate={handleNavigate}
        campusOperated={campusOperated}
        featureFlags={featureFlags}
      />
    );
  }

  return (
    <MainLegacyDashboardContent
      activeTab={activeTab}
      onTabChange={onTabChange}
      dashboard={dashboard}
      onNavigate={handleNavigate}
      matchingNavOptions={matchingNavOptions}
      seasonContextValue={seasonContextValue}
      campusOperated={campusOperated}
      featureFlags={featureFlags}
    />
  );
}

function MainHomeDashboardContent({
  activeTab,
  dashboard,
  homeDashboard,
  onNavigate,
  campusOperated,
  featureFlags,
}: {
  activeTab: TabId;
  dashboard: HomeDashboardResponse;
  homeDashboard: UseMainHomeDashboardResult;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  campusOperated: boolean;
  featureFlags: ReturnType<typeof getMainFeatureFlags>;
}) {
  const [showBuildingSelect, setShowBuildingSelect] = useState(false);
  const [isDeregisteringSeasonParticipation, setDeregisteringSeasonParticipation] = useState(false);
  const showToast = useCallback((msg: string) => toast(msg), []);
  const viewerUser = dashboard.viewer.identity.user;

  const handleSelectDormitory = useCallback(
    (dormitoryId: string) => {
      setShowBuildingSelect(false);
      if (dormitoryId === UNASSIGNED_ID) {
        showToast('건물 미배정으로 설정했어요');
        return;
      }
      const dormitory = getDormitoryById(dormitoryId);
      showToast(dormitory ? `${dormitory.name}(으)로 설정했어요` : '건물이 설정되었어요');
    },
    [showToast],
  );

  const handleDeregisterSeasonParticipation = useCallback(async () => {
    if (isDeregisteringSeasonParticipation) return;

    setDeregisteringSeasonParticipation(true);
    try {
      await seasonParticipationApi.deregisterCurrentSeasonParticipation();
      showToast('시즌 참여를 철회했어요.');
      await homeDashboard.refetch();
    } catch (error) {
      showToast('시즌 참여 철회를 완료하지 못했어요. 잠시 후 다시 시도해주세요.');
      throw error;
    } finally {
      setDeregisteringSeasonParticipation(false);
    }
  }, [homeDashboard, isDeregisteringSeasonParticipation, showToast]);

  return (
    <div className="min-h-screen bg-(--knu-background-alt) pb-20">
      {campusOperated &&
        (dashboard.season.isOpen || dashboard.season.isMatching) &&
        showBuildingSelect && (
          <BuildingSelectModal
            campus={viewerUser.campus}
            gender={viewerUser.gender}
            seasonSelectionLocked={dashboard.season.isOpen || dashboard.season.isMatching}
            onSelect={handleSelectDormitory}
            onClose={() => setShowBuildingSelect(false)}
          />
        )}
      <main>
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
            dashboard={homeDashboard.dashboard}
            onNavigate={onNavigate}
            onOpenBuildingSelect={() => setShowBuildingSelect(true)}
            onDashboardRefresh={homeDashboard.refetch}
            onDeregisterSeasonParticipation={handleDeregisterSeasonParticipation}
          />
        )}
      </main>

      <BottomTabBar
        activeTab={activeTab}
        onTabChange={onNavigate}
        disabledTabs={featureFlags.disabledTabs}
      />
    </div>
  );
}

function MainLegacyDashboardContent({
  activeTab,
  onTabChange,
  dashboard,
  onNavigate,
  matchingNavOptions,
  seasonContextValue,
  campusOperated,
  featureFlags,
}: {
  activeTab: TabId;
  onTabChange: Dispatch<SetStateAction<TabId>>;
  dashboard: HomeDashboardResponse;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  matchingNavOptions: MatchingNavOptions;
  seasonContextValue: ReturnType<typeof toMainSeasonContext>;
  campusOperated: boolean;
  featureFlags: ReturnType<typeof getMainFeatureFlags>;
}) {
  const initialUser = useMemo(() => toMainLegacyUserProfile(dashboard), [dashboard]);
  const showToast = useCallback((msg: string) => toast(msg), []);

  const handleNavigate = useCallback(
    (tab: TabId, options?: MatchingNavOptions) => {
      onNavigate(tab, options);
    },
    [onNavigate],
  );

  const { hasSeenGuide, markGuideSeen, hasSeenTooltip, markTooltipSeen } =
    useMainLocalOnboardingState(initialUser.id);

  const profileState = useMainProfileState(initialUser, {
    showToast,
    hasSeenGuide,
    markGuideSeen,
  });

  const needsLegacyData = LEGACY_DATA_TABS.has(activeTab);
  const legacyTabData = useMainLegacyTabData({
    enabled: needsLegacyData,
    currentUser: profileState.user,
    currentDormitoryId: profileState.user.dormitoryId,
  });
  const legacyData = legacyTabData.data;

  const socialState = useMainSocialState(showToast);

  const matchingState = useMainMatchingState(
    showToast,
    profileState.user,
    legacyData?.profiles ?? [],
    needsLegacyData,
  );

  const listViewState = useMainListViewState();

  function renderLegacyDataFallback() {
    if (!needsLegacyData || legacyData) return null;

    if (legacyTabData.error) {
      return <MainLegacyDataErrorState onRetry={legacyTabData.retry} />;
    }

    return activeTab === 'matching' ? <MatchingTabSkeleton /> : <AppShellSkeleton />;
  }

  return (
    <SeasonProvider value={seasonContextValue}>
      <div className="min-h-screen bg-(--knu-background-alt) pb-20">
        {campusOperated &&
          (seasonContextValue.isOpen || seasonContextValue.isMatching) &&
          profileState.showBuildingSelect && (
            <BuildingSelectModal
              campus={profileState.user.campus}
              gender={profileState.user.gender}
              seasonSelectionLocked={seasonContextValue.isOpen || seasonContextValue.isMatching}
              onSelect={(dormitoryId) => {
                profileState.handleSelectDormitory(dormitoryId);
                profileState.setShowBuildingSelect(false);
              }}
            />
          )}
        <main>
          {renderLegacyDataFallback()}
          {activeTab === 'list' && legacyData && (
            <RoommateListTab
              user={profileState.user}
              onNavigate={onTabChange}
              profiles={legacyData.profiles}
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
          {activeTab === 'matching' && legacyData && (
            <MatchingTab
              user={profileState.user}
              matchRequests={matchingState.matchRequests}
              activeMatch={matchingState.activeMatch}
              profiles={legacyData.profiles}
              pastSeasons={legacyData.pastSeasons}
              onCancelRequest={matchingState.handleCancelRequest}
              onAcceptRequest={matchingState.handleAcceptRequest}
              onRejectRequest={matchingState.handleRejectRequest}
              onConfirmMatch={matchingState.handleConfirmMatch}
              onRevokeConfirmMatch={matchingState.handleRevokeConfirmMatch}
              onFinalizePairGroup={matchingState.handleFinalizePairGroup}
              onEndConversation={matchingState.handleEndConversation}
              onEndMatch={matchingState.handleEndMatch}
              onNavigate={onTabChange}
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
              blockedUsers={socialState.blockedUsers}
              onUnblock={socialState.handleUnblockUser}
            />
          )}
          {activeTab === 'chat' && legacyData && (
            <ChatTab
              user={profileState.user}
              profiles={legacyData.profiles}
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
          onTabChange={onTabChange}
          badges={
            matchingState.receivedPendingCount > 0
              ? { matching: matchingState.receivedPendingCount }
              : undefined
          }
          disabledTabs={featureFlags.disabledTabs}
        />

        {profileState.showGuide && profileState.user.dormitoryId && (
          <DormitoryGuideSheet
            dormitoryId={profileState.user.dormitoryId}
            onClose={profileState.handleCloseGuide}
          />
        )}

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

function MainContent() {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window === 'undefined') return 'home';
    const saved = sessionStorage.getItem('activeTab');
    if (saved && ['home', 'list', 'matching', 'chat', 'profile'].includes(saved)) {
      return saved as TabId;
    }
    return 'home';
  });
  const homeDashboard = useMainHomeDashboard();

  useEffect(() => {
    window.scrollTo(0, 0);
    sessionStorage.setItem('activeTab', activeTab);
    document.title = getMainTabDocumentTitle(activeTab);
  }, [activeTab]);

  return (
    <MainInitialContent
      activeTab={activeTab}
      onTabChange={setActiveTab}
      homeDashboard={homeDashboard}
    />
  );
}

export default function Main() {
  return (
    <Suspense fallback={null}>
      <MainContent />
    </Suspense>
  );
}
