'use client';

import { useMemo, useState } from 'react';
import { OfflineBanner } from '@/components/OfflineBanner';
import { HomeQuickMenuSection } from './sections/quick-actions/HomeQuickMenuSection';
import { HomeDashboardLayout } from './layout/HomeDashboardLayout';
import { HomeHeader } from './layout/HomeHeader';
import { HomeNonOperatedOverlay } from './layout/HomeNonOperatedOverlay';
import { HomePrimaryStateCard } from './sections/primary/HomePrimaryStateCard';
import { HomeActivityPanel } from './sections/activity/HomeActivityPanel';
import { HomeReadinessChecklist } from './sections/readiness/HomeReadinessChecklist';
import { HomeMatchingRegisteredGuidePanel } from './sections/readiness/HomeMatchingRegisteredGuidePanel';
import { HomeOperationsSurface } from './sections/operations/HomeOperationsSurface';
import { homeActiveMatchApi } from './api/home-active-match.api';
import { buildHomeDashboardViewModel } from './model/homeDashboardViewModel';
import type { TabId, MatchingNavOptions } from '@/types/profile';
import type { HomeDashboardResponse } from '@repo/shared/home';

interface HomeTabProps {
  dashboard: HomeDashboardResponse;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  onOpenBuildingSelect?: () => void;
  onDashboardRefresh?: () => Promise<void>;
  onDeregisterSeasonParticipation?: () => Promise<void>;
  renderedAtOverride?: number;
}

export default function HomeTab({
  dashboard,
  onNavigate,
  onOpenBuildingSelect,
  onDashboardRefresh,
  onDeregisterSeasonParticipation,
  renderedAtOverride,
}: HomeTabProps) {
  const [renderedAt] = useState(() => renderedAtOverride ?? Date.now());
  const viewModel = useMemo(
    () =>
      buildHomeDashboardViewModel({
        dashboard,
        renderedAt,
      }),
    [dashboard, renderedAt],
  );
  const { seasonState, daysUntilEnd } = viewModel;
  const handleRequestActiveMatchUnmatch = async (activeMatchId: string) => {
    await homeActiveMatchApi.requestUnmatch(activeMatchId);
    await onDashboardRefresh?.();
  };

  const handleCancelActiveMatchUnmatchRequest = async (activeMatchId: string) => {
    await homeActiveMatchApi.cancelUnmatchRequest(activeMatchId);
    await onDashboardRefresh?.();
  };

  const dashboardContainerClassName = !viewModel.isCampusOperated
    ? 'relative h-[calc(100dvh-14rem)] min-h-80 overflow-hidden overscroll-none md:h-auto md:min-h-0 md:overflow-visible'
    : 'relative';

  return (
    <div>
      <OfflineBanner />

      <HomeHeader
        viewModel={viewModel}
        seasonState={seasonState}
        daysUntilEnd={daysUntilEnd}
        onNavigateProfile={() => onNavigate('profile')}
      />

      <div data-testid="home-dashboard-container" className={dashboardContainerClassName}>
        {!viewModel.isCampusOperated && <HomeNonOperatedOverlay />}

        <div
          data-testid="home-content"
          inert={!viewModel.isCampusOperated}
          aria-hidden={!viewModel.isCampusOperated}
          className={
            !viewModel.isCampusOperated ? 'pointer-events-none select-none grayscale-50' : ''
          }
        >
          <HomeDashboardLayout
            primary={
              <HomePrimaryStateCard
                viewModel={viewModel}
                seasonState={seasonState}
                daysUntilEnd={daysUntilEnd}
                onNavigate={onNavigate}
                onOpenBuildingSelect={onOpenBuildingSelect}
                onDeregisterSeasonParticipation={onDeregisterSeasonParticipation}
              />
            }
            readiness={
              seasonState === 'SEASON_MATCHING' && viewModel.preparation.registrationReady ? (
                <HomeMatchingRegisteredGuidePanel viewModel={viewModel} />
              ) : (
                <HomeReadinessChecklist
                  dashboard={dashboard}
                  viewModel={viewModel}
                  onNavigate={onNavigate}
                  onOpenBuildingSelect={onOpenBuildingSelect}
                />
              )
            }
            activity={
              <HomeActivityPanel
                viewModel={viewModel}
                seasonState={seasonState}
                onNavigate={onNavigate}
                onDeregisterSeasonParticipation={onDeregisterSeasonParticipation}
                onRequestActiveMatchUnmatch={handleRequestActiveMatchUnmatch}
                onCancelActiveMatchUnmatchRequest={handleCancelActiveMatchUnmatchRequest}
              />
            }
            operations={<HomeOperationsSurface />}
            quickActions={
              <HomeQuickMenuSection
                seasonState={seasonState}
                hasCurrentSeason={viewModel.hasCurrentSeason}
                canEnterRoommateSearch={viewModel.capabilities.canEnterRoommateSearch}
                canStartChat={dashboard.viewer.capabilities.canStartChat}
                canViewMatchHistory={viewModel.capabilities.canViewMatchHistory}
                onNavigateList={() => onNavigate('list')}
                onNavigateMatching={() => onNavigate('matching', { section: 'current' })}
                onNavigateMatchingHistory={() => onNavigate('matching', { section: 'past' })}
                onNavigateChat={() => onNavigate('chat')}
                onNavigateProfile={() => onNavigate('profile')}
              />
            }
          />
        </div>
      </div>
    </div>
  );
}
