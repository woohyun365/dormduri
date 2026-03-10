'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { BottomTabBar } from './components/BottomTabBar';
import { BuildingSelectModal } from './components/BuildingSelectModal';
import { DormitoryGuideSheet } from './components/DormitoryGuideSheet';
import { MatchCelebrationModal } from './components/MatchCelebrationModal';
import HomeTab from './tabs/home/HomeTab';
import RoommateListTab from './tabs/roommate-list/RoommateListTab';
import ProfileTab from './tabs/ProfileTab';
import SettingsTab from './tabs/SettingsTab';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { useMainProfileState } from './hooks/useMainProfileState';
import { useMainSocialState } from './hooks/useMainSocialState';
import { useMainMatchingState } from './hooks/useMainMatchingState';
import { useMainListViewState } from './hooks/useMainListViewState';
import { buildMainBuildingStats } from './utils/buildMainBuildingStats';
import { TOAST_DURATION } from '@/constants/ui';
import { mockRawProfiles } from '@/__fixtures__/profiles';
import type { TabId, UserProfile } from '@/types/profile';

export type { TabId, UserProfile } from '@/types/profile';

function MainContent({ initialUser }: { initialUser: UserProfile }) {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [toast, setToast] = useState<string | null>(null);

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

  const socialState = useMainSocialState(showToast);

  const matchingState = useMainMatchingState(showToast, profileState.user.lifestyle);

  const listViewState = useMainListViewState();

  // --- Derived ---
  const buildingStats = useMemo(
    () => buildMainBuildingStats(profileState.user, mockRawProfiles),
    [profileState.user],
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

  return (
    <div className="min-h-screen bg-[var(--knu-background-alt)] pb-20">
      {(profileState.user.dormitoryId === null || profileState.showBuildingSelect) && (
        <BuildingSelectModal
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
            matchRequests={matchingState.matchRequests}
            activeMatch={matchingState.activeMatch}
            onCancelRequest={matchingState.handleCancelRequest}
            onAcceptRequest={matchingState.handleAcceptRequest}
            onRejectRequest={matchingState.handleRejectRequest}
            onEndMatch={matchingState.handleEndMatch}
            profiles={mockRawProfiles}
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
            profiles={mockRawProfiles}
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
            onSendRequest={matchingState.handleSendRequest}
            bookmarkedUserIds={socialState.bookmarkedUserIds}
            onToggleBookmark={socialState.handleToggleBookmark}
            showProfileBanner={listViewState.showProfileBanner}
            onDismissProfileBanner={listViewState.dismissProfileBanner}
            showMatchScoreTip={!hasSeenTooltip('matchScore')}
            onDismissMatchScoreTip={() => markTooltipSeen('matchScore')}
            showMatchRequestTip={!hasSeenTooltip('matchRequest')}
            onDismissMatchRequestTip={() => markTooltipSeen('matchRequest')}
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
            ? { home: matchingState.receivedPendingCount }
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
  );
}

export default function Main({ initialUser }: { initialUser: UserProfile }) {
  return (
    <Suspense fallback={null}>
      <MainContent initialUser={initialUser} />
    </Suspense>
  );
}
