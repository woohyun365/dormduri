'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { BottomTabBar } from './components/BottomTabBar';
import { BuildingSelectModal } from './components/BuildingSelectModal';
import { DormitoryGuideSheet } from './components/DormitoryGuideSheet';
import HomeTab from './tabs/home/HomeTab';
import RoommateListTab from './tabs/roommate-list/RoommateListTab';
import ProfileTab from './tabs/profile/ProfileTab';
import MatchingTab from './tabs/matching/MatchingTab';
import ChatTab from './tabs/chat/ChatTab';
import { HomeTabSkeleton } from '@/main/components/feedback/Skeleton';
import { HomeDashboardErrorState } from './tabs/home/layout/HomeDashboardErrorState';
import { MatchingTabSkeleton } from './tabs/matching/layout/MatchingTabSkeleton';
import { useMainLocalOnboardingState } from '@/main/hooks/useMainLocalOnboardingState';
import { useMainProfileState } from './hooks/useMainProfileState';
import { useMainSocialState } from './hooks/useMainSocialState';
import {
  useMainHomeDashboard,
  type UseMainHomeDashboardResult,
} from './hooks/useMainHomeDashboard';
import { seasonParticipationApi } from './api/season-participation.api';
import { SeasonProvider } from '@/main/contexts/SeasonContext';
import { getMainFeatureFlags } from './utils/mainFeatureFlags';
import { getMainTabDocumentTitle } from './utils/mainTabTitle';
import { toMainSeasonContext, toMainLegacyUserProfile } from './utils/mainDashboardAdapters';
import { getDormitoryById, UNASSIGNED_ID } from '@/constants/dormitory';
import type { MatchingNavOptions, TabId } from '@/types/profile';
import type { HomeDashboardResponse } from '@repo/shared/home';

export type { TabId } from '@/types/profile';

function MainShellFrame({
  activeTab,
  onTabChange,
  children,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-(--knu-background-alt) pb-20">
      {children}
      <BottomTabBar activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}

function MainInitialContent({
  activeTab,
  onNavigate,
  matchingNavOptions,
  homeDashboard,
}: {
  activeTab: TabId;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  matchingNavOptions: MatchingNavOptions | null;
  homeDashboard: UseMainHomeDashboardResult;
}) {
  if (homeDashboard.loading || !homeDashboard.dashboard) {
    if (homeDashboard.error) {
      return (
        <MainShellFrame activeTab={activeTab} onTabChange={onNavigate}>
          <HomeDashboardErrorState
            message={homeDashboard.error}
            refreshing={homeDashboard.refreshing}
            onRetry={homeDashboard.refetch}
          />
        </MainShellFrame>
      );
    }

    return (
      <MainShellFrame activeTab={activeTab} onTabChange={onNavigate}>
        {activeTab === 'matching' ? <MatchingTabSkeleton /> : <HomeTabSkeleton />}
      </MainShellFrame>
    );
  }

  return (
    <MainDashboardContent
      activeTab={activeTab}
      onNavigate={onNavigate}
      matchingNavOptions={matchingNavOptions}
      dashboard={homeDashboard.dashboard}
      homeDashboard={homeDashboard}
    />
  );
}

function MainDashboardContent({
  activeTab,
  onNavigate,
  matchingNavOptions,
  dashboard,
  homeDashboard,
}: {
  activeTab: TabId;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  matchingNavOptions: MatchingNavOptions | null;
  dashboard: HomeDashboardResponse;
  homeDashboard: UseMainHomeDashboardResult;
}) {
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
        onNavigate={onNavigate}
        campusOperated={campusOperated}
        featureFlags={featureFlags}
      />
    );
  }

  return (
    <MainLegacyDashboardContent
      activeTab={activeTab}
      dashboard={dashboard}
      onNavigate={onNavigate}
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
  dashboard,
  onNavigate,
  matchingNavOptions,
  seasonContextValue,
  campusOperated,
  featureFlags,
}: {
  activeTab: TabId;
  dashboard: HomeDashboardResponse;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  matchingNavOptions: MatchingNavOptions | null;
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

  const { hasSeenGuide, markGuideSeen } = useMainLocalOnboardingState(initialUser.id);

  const profileState = useMainProfileState(initialUser, {
    showToast,
    hasSeenGuide,
    markGuideSeen,
  });

  const socialState = useMainSocialState(showToast);
  const [matchingBadgeCount, setMatchingBadgeCount] = useState(0);

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
          {activeTab === 'list' && (
            <RoommateListTab
              user={profileState.user}
              onNavigate={handleNavigate}
              searchEntryAllowed={dashboard.viewer.capabilities.canEnterRoommateSearch}
              viewerSeasonRegistered={dashboard.viewer.seasonProfile.registered}
            />
          )}
          {activeTab === 'matching' && (
            <MatchingTab
              viewerId={profileState.user.id}
              seasonShell={{
                id: dashboard.season.summary?.id ?? null,
                state: dashboard.season.state,
              }}
              onBadgeCountChange={setMatchingBadgeCount}
              onNavigateChat={() => handleNavigate('chat')}
              initialRequestTab={matchingNavOptions?.requestTab}
              initialSection={matchingNavOptions?.section}
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
          {activeTab === 'chat' && (
            <ChatTab viewerId={profileState.user.id} onNavigate={handleNavigate} />
          )}
        </main>

        <BottomTabBar
          activeTab={activeTab}
          onTabChange={handleNavigate}
          badges={matchingBadgeCount > 0 ? { matching: matchingBadgeCount } : undefined}
          disabledTabs={featureFlags.disabledTabs}
        />

        {profileState.showGuide && profileState.user.dormitoryId && (
          <DormitoryGuideSheet
            dormitoryId={profileState.user.dormitoryId}
            onClose={profileState.handleCloseGuide}
          />
        )}
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
  const [matchingNavOptions, setMatchingNavOptions] = useState<MatchingNavOptions | null>(null);
  const homeDashboard = useMainHomeDashboard();

  const handleNavigate = useCallback((tab: TabId, options?: MatchingNavOptions) => {
    setMatchingNavOptions(tab === 'matching' ? (options ?? null) : null);
    setActiveTab(tab);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    sessionStorage.setItem('activeTab', activeTab);
    document.title = getMainTabDocumentTitle(activeTab);
  }, [activeTab]);

  return (
    <MainInitialContent
      activeTab={activeTab}
      onNavigate={handleNavigate}
      matchingNavOptions={matchingNavOptions}
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
