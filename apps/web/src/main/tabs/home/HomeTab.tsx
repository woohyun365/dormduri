'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Building2, Calendar, School, ShieldAlert } from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { OfflineBanner } from '@/components/OfflineBanner';
import { readHomeMatchingSummaryOverrides } from '@/main/utils/homeDevOverrides';
import { HomeSeasonBanner } from './HomeSeasonBanner';
import { HomeMatchingSummary } from './HomeMatchingSummary';
import { SeasonPreparationCard } from './SeasonPreparationCard';
import { SeasonSummaryCard } from './SeasonSummaryCard';
import { HomeQuickMenuSection } from './HomeQuickMenuSection';
import { BuildingStatsBar } from './BuildingStatsBar';
import { DynamicTipBanner } from './DynamicTipBanner';
import { buildHomeDashboardViewModel } from './model/homeDashboardViewModel';
import type { TabId, UserProfile, MatchingNavOptions } from '@/types/profile';
import type { HomeDashboardResponse } from '@repo/shared/home';

interface HomeTabProps {
  user: UserProfile;
  dashboard: HomeDashboardResponse;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  onOpenBuildingSelect?: () => void;
}

export default function HomeTab({
  user,
  dashboard,
  onNavigate,
  onOpenBuildingSelect,
}: HomeTabProps) {
  const [renderedAt] = useState(() => Date.now());
  const { season, state: seasonState, isMatching, daysUntilEnd } = useSeasonContext();
  const viewModel = useMemo(
    () =>
      buildHomeDashboardViewModel({
        dashboard,
        user,
        season,
        seasonState,
        daysUntilEnd,
        renderedAt,
        matchingOverrides: readHomeMatchingSummaryOverrides(),
      }),
    [dashboard, daysUntilEnd, renderedAt, season, seasonState, user],
  );

  return (
    <div>
      <OfflineBanner />

      <header className="bg-[var(--knu-primary)] text-white px-5 py-6">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm opacity-90 mb-1">안녕하세요,</p>
              <h1 className="text-2xl font-bold">{user.nickname}님</h1>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigate('profile')}
              className={`w-14 h-14 ${getAvatarColor(user.nickname).bg} rounded-full flex items-center justify-center text-2xl font-bold ${getAvatarColor(user.nickname).text} cursor-pointer`}
            >
              {user.nickname.charAt(0)}
            </motion.button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm opacity-90">
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-semibold">
                {user.gender === 'M' ? '남' : '여'}
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
            {isMatching && daysUntilEnd > 0 && (
              <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-semibold">
                <Calendar className="w-3 h-3" />
                <span>D-{daysUntilEnd}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="relative">
        {!viewModel.isCampusOperated && (
          <div className="absolute inset-0 z-10 backdrop-blur-[8px] bg-white/60 border border-white/30 flex items-center justify-center">
            <div className="text-center px-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-base font-bold text-[var(--knu-text-primary)] mb-1">
                서비스 운영 준비 중이에요!
              </p>
              <p className="text-sm text-[var(--knu-text-secondary)]">조금만 기다려주세요.</p>
            </div>
          </div>
        )}

        <div
          data-testid="home-content"
          inert={!viewModel.isCampusOperated}
          aria-hidden={!viewModel.isCampusOperated}
          className={`max-w-md mx-auto px-5 py-5 space-y-5 ${
            !viewModel.isCampusOperated ? 'pointer-events-none select-none grayscale-[50%]' : ''
          }`}
        >
          <HomeSeasonBanner
            isUnassigned={viewModel.isUnassigned}
            hasActiveMatch={viewModel.hasActiveMatch}
          >
            <BuildingStatsBar
              seasonState={seasonState}
              hasBuilding={viewModel.dormitory !== null}
              buildingName={viewModel.dormitory?.name}
              totalCount={viewModel.statsBar.totalCount}
              buildingCount={viewModel.statsBar.buildingCount}
              todayNewTotal={viewModel.statsBar.todayNewTotal}
              todayNewBuilding={viewModel.statsBar.todayNewBuilding}
              matchSuccessCount={viewModel.statsBar.matchSuccessCount}
              urgency={viewModel.statsBar.urgency}
              daysLeft={daysUntilEnd}
            />
          </HomeSeasonBanner>

          {seasonState === 'SEASON_MATCHING' && (
            <HomeMatchingSummary
              status={viewModel.matchingSummary.status}
              stats={viewModel.matchingSummary.stats}
              activeMatch={viewModel.matchingSummary.activeMatch}
              receivedRequesters={viewModel.matchingSummary.receivedRequesters}
              gatingReason={viewModel.matchingSummary.gatingReason}
              onGatedAction={() => onOpenBuildingSelect?.()}
              onNavigate={onNavigate}
            />
          )}

          {seasonState === 'SEASON_OPEN' && (
            <SeasonPreparationCard
              daysUntilStart={viewModel.preparation.daysUntilStart}
              seasonStartDate={viewModel.preparation.seasonStartDate}
              profileCompletion={viewModel.preparation.profileCompletion}
              hasBuilding={viewModel.preparation.hasBuilding}
              canSelectBuilding={viewModel.preparation.canSelectBuilding}
              hasLifestylePattern={viewModel.preparation.hasLifestylePattern}
              onNavigateProfile={() => onNavigate('profile')}
              onOpenBuildingSelect={() => onOpenBuildingSelect?.()}
              missingFields={viewModel.preparation.missingFields}
            />
          )}

          {seasonState === 'OFF_SEASON' && (
            <SeasonSummaryCard
              pastSeasonName={viewModel.seasonSummary.pastSeasonName}
              daysUntilNext={viewModel.seasonSummary.daysUntilNext}
              nextSeasonDate={viewModel.seasonSummary.nextSeasonDate}
              nextSeasonName={viewModel.seasonSummary.nextSeasonName}
              pastSeasonResult={undefined}
              onViewHistory={() => onNavigate('matching', { section: 'past' })}
            />
          )}

          {seasonState === 'SEASON_MATCHING' && (
            <DynamicTipBanner
              seasonStatus={viewModel.tip.seasonStatus}
              receivedRequests={viewModel.tip.receivedRequests}
              sentRequests={viewModel.tip.sentRequests}
              activeChats={viewModel.tip.activeChats}
              unreadMessages={viewModel.tip.unreadMessages}
            />
          )}

          <HomeQuickMenuSection
            seasonState={seasonState}
            canStartChat={dashboard.viewer.capabilities.canStartChat}
            onNavigateList={() => onNavigate('list')}
            onNavigateMatching={() => onNavigate('matching', { section: 'current' })}
            onNavigateMatchingHistory={() => onNavigate('matching', { section: 'past' })}
            onNavigateChat={() => onNavigate('chat')}
            onNavigateProfile={() => onNavigate('profile')}
          />
        </div>
      </div>
    </div>
  );
}
