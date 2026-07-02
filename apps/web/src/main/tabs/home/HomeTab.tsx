'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Building2, Calendar, School, ShieldAlert } from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { OfflineBanner } from '@/components/OfflineBanner';
import { HomeQuickMenuSection } from './components/HomeQuickMenuSection';
import { HomeDashboardLayout } from './HomeDashboardLayout';
import { HomePrimaryStateCard } from './components/HomePrimaryStateCard';
import { HomeActivityPanel } from './components/HomeActivityPanel';
import { HomeReadinessChecklist } from './components/HomeReadinessChecklist';
import { HomeMatchingRegisteredGuidePanel } from './components/HomeMatchingRegisteredGuidePanel';
import { HomeOperationsPanel } from './components/HomeOperationsPanel';
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
  const avatarColor = getAvatarColor(viewModel.viewerIdentity.nickname);

  const postActiveMatchUnmatchAction = async (
    activeMatchId: string,
    action: 'request' | 'cancel',
  ) => {
    const suffix = action === 'cancel' ? '/cancel' : '';
    const response = await fetch(
      `/api/matches/active/${encodeURIComponent(activeMatchId)}/unmatch-request${suffix}`,
      { method: 'POST' },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(payload?.message ?? '매칭 해제 요청을 처리하지 못했어요.');
    }

    await onDashboardRefresh?.();
  };

  const handleRequestActiveMatchUnmatch = (activeMatchId: string) =>
    postActiveMatchUnmatchAction(activeMatchId, 'request');

  const handleCancelActiveMatchUnmatchRequest = (activeMatchId: string) =>
    postActiveMatchUnmatchAction(activeMatchId, 'cancel');

  const dashboardContainerClassName = !viewModel.isCampusOperated
    ? 'relative h-[calc(100dvh-14rem)] min-h-80 overflow-hidden overscroll-none md:h-auto md:min-h-0 md:overflow-visible'
    : 'relative';

  return (
    <div>
      <OfflineBanner />

      <header className="bg-(--knu-primary) py-6 text-white">
        <div className="mx-auto max-w-md px-5 md:max-w-5xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm opacity-90 mb-1">안녕하세요,</p>
              <h1 className="text-2xl font-bold">{viewModel.viewerIdentity.nickname}님</h1>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigate('profile')}
              className={`w-14 h-14 ${avatarColor.bg} rounded-full flex items-center justify-center text-2xl font-bold ${avatarColor.text} cursor-pointer`}
            >
              {viewModel.viewerIdentity.avatarInitial}
            </motion.button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm opacity-90">
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-semibold">
                {viewModel.viewerIdentity.genderLabel}
              </span>
              {viewModel.dormitory ? (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-semibold">
                  <Building2 className="w-3.5 h-3.5" />
                  {viewModel.dormitory.name} · {viewModel.dormitory.roomType}인실
                </span>
              ) : seasonState === 'OFF_SEASON' || !viewModel.isCampusOperated ? (
                <span className="flex items-center gap-1">
                  <School className="w-3.5 h-3.5" />
                  {viewModel.campusName}
                </span>
              ) : viewModel.isUnassigned ? (
                <span className="flex items-center gap-1 opacity-75">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  건물 미배정
                </span>
              ) : null}
            </div>
            {viewModel.isSeasonMatching && daysUntilEnd > 0 && (
              <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-semibold">
                <Calendar className="w-3 h-3" />
                <span>D-{daysUntilEnd}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div data-testid="home-dashboard-container" className={dashboardContainerClassName}>
        {!viewModel.isCampusOperated && (
          <div
            data-testid="home-non-operated-overlay"
            className="absolute inset-0 z-10 flex touch-none items-center justify-center overflow-hidden border border-white/30 bg-white/70 overscroll-none backdrop-blur-sm"
          >
            <div className="px-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <ShieldAlert className="h-8 w-8 text-gray-400" />
              </div>
              <p className="mb-1 text-base font-bold text-(--knu-text-primary)">
                해당 캠퍼스는 서비스 운영 준비 중이에요!
              </p>
              <p className="text-sm text-(--knu-text-secondary)">조금만 기다려주세요.</p>
            </div>
          </div>
        )}

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
            operations={<HomeOperationsPanel />}
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
