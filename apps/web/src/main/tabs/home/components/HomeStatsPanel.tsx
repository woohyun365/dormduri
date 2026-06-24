'use client';

import { BarChart3, CheckCircle2, Users } from 'lucide-react';
import { BuildingStatsBar } from './BuildingStatsBar';
import { sectionCard, sectionHeader } from '@/main/styles/home';
import type { SeasonState } from '@/types/season';
import type { HomeDashboardViewModel } from '../model/homeDashboardViewModel';

interface HomeStatsPanelProps {
  viewModel: HomeDashboardViewModel;
  seasonState: SeasonState;
  daysUntilEnd: number;
}

export function HomeStatsPanel({ viewModel, seasonState, daysUntilEnd }: HomeStatsPanelProps) {
  if (!viewModel.hasCurrentSeason || seasonState === 'SEASON_POST_MATCH') {
    return <CompactStatsPanel viewModel={viewModel} seasonState={seasonState} />;
  }

  return (
    <section className={sectionCard('md:sticky md:top-4')} aria-labelledby="home-stats-title">
      <div className={sectionHeader}>
        <div>
          <h2 id="home-stats-title" className="font-bold text-(--knu-text-primary)">
            시즌 통계
          </h2>
          <p className="mt-1 text-xs text-(--knu-text-tertiary)">
            현재 시즌 참여 흐름을 안내용으로 보여드려요.
          </p>
        </div>
        <BarChart3 className="w-5 h-5 text-(--knu-primary)" aria-hidden="true" />
      </div>
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
    </section>
  );
}

function CompactStatsPanel({
  viewModel,
  seasonState,
}: {
  viewModel: HomeDashboardViewModel;
  seasonState: SeasonState;
}) {
  const title = seasonState === 'SEASON_POST_MATCH' ? '시즌 결과 요약' : '서비스 현황';
  const helper =
    seasonState === 'SEASON_POST_MATCH'
      ? '신규 요청은 닫혔고, 결과 확인과 기록 조회 중심으로 보여드려요.'
      : '진행 중인 시즌이 없을 때는 누적 현황만 참고용으로 보여드려요.';

  return (
    <section
      className={sectionCard('md:sticky md:top-4')}
      aria-labelledby="home-compact-stats-title"
    >
      <div className={sectionHeader}>
        <div>
          <h2 id="home-compact-stats-title" className="font-bold text-(--knu-text-primary)">
            {title}
          </h2>
          <p className="mt-1 text-xs text-(--knu-text-tertiary)">{helper}</p>
        </div>
        <BarChart3 className="w-5 h-5 text-(--knu-primary)" aria-hidden="true" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCell
          icon={Users}
          label="시즌 참여"
          value={viewModel.statsBar.totalCount}
          unit="명"
          tone="blue"
        />
        <StatCell
          icon={CheckCircle2}
          label="매칭 성공"
          value={viewModel.statsBar.matchSuccessCount}
          unit="명"
          tone="green"
        />
      </div>
      {viewModel.dormitory && (
        <p className="mt-3 text-xs text-(--knu-text-tertiary)">
          내 건물 {viewModel.dormitory.name} 기준 참여 {viewModel.statsBar.buildingCount}명
        </p>
      )}
    </section>
  );
}

function StatCell({
  icon: Icon,
  label,
  value,
  unit,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  unit: string;
  tone: 'blue' | 'green';
}) {
  const toneClass = tone === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600';

  return (
    <div className="rounded-xl border border-(--knu-border) bg-(--knu-background-alt) p-3">
      <div className="flex items-center gap-1.5 text-xs text-(--knu-text-tertiary) mb-2">
        <span className={`w-7 h-7 rounded-lg ${toneClass} flex items-center justify-center`}>
          <Icon className="w-4 h-4" aria-hidden="true" />
        </span>
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-(--knu-text-primary)">{value}</span>
        <span className="text-sm text-(--knu-text-secondary)">{unit}</span>
      </div>
    </div>
  );
}
