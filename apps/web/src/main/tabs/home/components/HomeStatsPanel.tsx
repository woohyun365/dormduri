'use client';

import { BarChart3, CheckCircle2, History, Users } from 'lucide-react';
import { BuildingStatsBar } from './BuildingStatsBar';
import { sectionCard, sectionHeader } from '@/main/styles/home';
import type { SeasonState } from '@repo/shared/season/runtime';
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
  const summary = resolveCompactStatsSummary(viewModel, seasonState);
  const SummaryIcon = summary.icon;

  return (
    <section
      className={sectionCard('md:sticky md:top-4')}
      aria-labelledby="home-compact-stats-title"
    >
      <div className={sectionHeader}>
        <div>
          <h2 id="home-compact-stats-title" className="font-bold text-(--knu-text-primary)">
            {summary.title}
          </h2>
          <p className="mt-1 text-xs text-(--knu-text-tertiary)">{summary.helper}</p>
        </div>
        <SummaryIcon className="w-5 h-5 text-(--knu-primary)" aria-hidden="true" />
      </div>
      <p className="mb-3 rounded-xl bg-(--knu-background-alt) p-3 text-xs leading-relaxed text-(--knu-text-secondary)">
        {summary.body}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <StatCell
          icon={Users}
          label={summary.participantLabel}
          value={summary.participantValue}
          unit="명"
          tone="blue"
        />
        <StatCell
          icon={CheckCircle2}
          label={summary.matchSuccessLabel}
          value={summary.matchSuccessValue}
          unit={summary.matchSuccessUnit}
          tone="green"
        />
      </div>
      {summary.extraText && (
        <p className="mt-3 text-xs leading-relaxed text-(--knu-text-tertiary)">
          {summary.extraText}
        </p>
      )}
      {viewModel.dormitory && (
        <p className="mt-3 text-xs text-(--knu-text-tertiary)">
          내 건물 {viewModel.dormitory.name} 기준 참여 {viewModel.statsBar.buildingCount}명
        </p>
      )}
    </section>
  );
}

function resolveCompactStatsSummary(
  viewModel: HomeDashboardViewModel,
  seasonState: SeasonState,
): {
  title: string;
  helper: string;
  body: string;
  participantLabel: string;
  participantValue: number;
  matchSuccessLabel: string;
  matchSuccessValue: number;
  matchSuccessUnit: string;
  icon: React.ElementType;
  extraText?: string;
} {
  const lastSeason = viewModel.seasonSummary.lastSeason;

  if (seasonState === 'SEASON_POST_MATCH') {
    return {
      title: '시즌 결과 요약',
      helper: '신규 요청은 닫고, 결과 확인과 기록 조회 중심으로 보여드려요.',
      body: `${viewModel.seasonSummary.pastSeasonName} 결과를 기준으로 참여와 매칭 성공 현황을 확인할 수 있어요.`,
      participantLabel: '시즌 참여',
      participantValue: viewModel.statsBar.totalCount,
      matchSuccessLabel: '매칭 성공',
      matchSuccessValue: viewModel.statsBar.matchSuccessCount,
      matchSuccessUnit: '명',
      icon: BarChart3,
    };
  }

  if (!lastSeason) {
    return {
      title: '서비스 현황',
      helper: '아직 누적 시즌 기록이 없을 때는 다음 시즌 안내를 먼저 보여드려요.',
      body: '아직 완료된 시즌 기록이 없어요. 새 시즌이 열리면 참여 현황과 매칭 결과가 이 영역에 쌓입니다.',
      participantLabel: '누적 참여',
      participantValue: 0,
      matchSuccessLabel: '매칭 성공',
      matchSuccessValue: 0,
      matchSuccessUnit: '명',
      icon: History,
    };
  }

  return {
    title: '지난 시즌 요약',
    helper: '한 눈에 알아보기',
    body: `${lastSeason.name} 참여 흐름과 매칭 결과를 한눈에 확인해보세요.`,
    participantLabel: '지난 참여',
    participantValue: lastSeason.totalParticipants,
    matchSuccessLabel: '매칭 완료',
    matchSuccessValue: lastSeason.aggregate.matchedPairCount,
    matchSuccessUnit: '쌍',
    icon: History,
    extraText: `운영 기숙사 ${lastSeason.aggregate.operatedDormitoryCount}곳 기준 · 매칭 유저 ${lastSeason.totalMatchSuccess}명`,
  };
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
