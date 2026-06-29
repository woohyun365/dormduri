'use client';

import { Info, Lightbulb } from 'lucide-react';
import { DynamicTipBanner } from './DynamicTipBanner';
import { sectionCard, sectionHeader } from '@/main/styles/home';
import type { SeasonState } from '@repo/shared/season/runtime';
import type { HomeDashboardViewModel } from '../model/homeDashboardViewModel';

interface HomeStatusTipProps {
  viewModel: HomeDashboardViewModel;
  seasonState: SeasonState;
  onOpenOnboarding?: () => void;
}

export function HomeStatusTip({ viewModel, seasonState, onOpenOnboarding }: HomeStatusTipProps) {
  if (viewModel.hasCurrentSeason && seasonState === 'SEASON_MATCHING') {
    return (
      <section className={sectionCard()} data-testid="home-status-tip">
        <div className={sectionHeader}>
          <h2 className="font-bold text-(--knu-text-primary)">오늘의 안내</h2>
          <Lightbulb className="w-5 h-5 text-(--knu-primary)" aria-hidden="true" />
        </div>
        <DynamicTipBanner
          seasonStatus={viewModel.tip.seasonStatus}
          receivedRequests={viewModel.tip.receivedRequests}
          sentRequests={viewModel.tip.sentRequests}
          activeChats={viewModel.tip.activeChats}
          unreadMessages={viewModel.tip.unreadMessages}
        />
        <OnboardingReplayButton onClick={onOpenOnboarding} />
      </section>
    );
  }

  const message = resolveStaticTip(viewModel, seasonState);

  return (
    <section className={sectionCard()} data-testid="home-status-tip">
      <div className={sectionHeader}>
        <div>
          <h2 className="font-bold text-(--knu-text-primary)">이용 안내</h2>
          <p className="mt-1 text-xs leading-relaxed text-(--knu-text-tertiary)">{message}</p>
        </div>
        <Info className="w-5 h-5 text-(--knu-primary)" aria-hidden="true" />
      </div>
      <OnboardingReplayButton onClick={onOpenOnboarding} />
    </section>
  );
}

function resolveStaticTip(viewModel: HomeDashboardViewModel, seasonState: SeasonState): string {
  if (!viewModel.isCampusOperated) {
    return '운영 캠퍼스가 열리면 시즌 일정과 참여 상태를 이 홈 화면에서 안내합니다.';
  }
  if (!viewModel.hasCurrentSeason) {
    return '시즌 전 안내를 다시 확인할 수 있어요.';
  }
  if (seasonState === 'SEASON_OPEN') {
    return '신청 전에는 생활패턴과 건물 선택을 정비할 수 있고, 신청 후에는 이번 시즌 정보로 사용돼요.';
  }
  if (seasonState === 'SEASON_POST_MATCH') {
    return '시즌 마감 정리 기간에는 새 요청보다 결과 확인과 확정된 관계 안내가 우선입니다.';
  }
  return '비시즌에는 타인 탐색이 닫히고, 다음 시즌 일정과 이전 기록 확인을 중심으로 이용합니다.';
}

function OnboardingReplayButton({ onClick }: { onClick?: () => void }) {
  if (!onClick) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-(--knu-border) bg-(--knu-background-alt) px-3 text-xs font-bold text-(--knu-text-secondary) transition-colors hover:border-(--knu-primary) hover:bg-blue-50 hover:text-(--knu-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)"
    >
      이용 안내 다시 보기
    </button>
  );
}
