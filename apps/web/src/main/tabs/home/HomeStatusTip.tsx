'use client';

import { Info, Lightbulb } from 'lucide-react';
import { DynamicTipBanner } from './DynamicTipBanner';
import { sectionCard, sectionHeader } from '@/main/styles/home';
import type { SeasonState } from '@/types/season';
import type { HomeDashboardViewModel } from './model/homeDashboardViewModel';

interface HomeStatusTipProps {
  viewModel: HomeDashboardViewModel;
  seasonState: SeasonState;
}

export function HomeStatusTip({ viewModel, seasonState }: HomeStatusTipProps) {
  if (viewModel.hasCurrentSeason && seasonState === 'SEASON_MATCHING') {
    return (
      <section className={sectionCard()} data-testid="home-status-tip">
        <div className={sectionHeader}>
          <h2 className="font-bold text-[var(--knu-text-primary)]">오늘의 안내</h2>
          <Lightbulb className="w-5 h-5 text-[var(--knu-primary)]" aria-hidden="true" />
        </div>
        <DynamicTipBanner
          seasonStatus={viewModel.tip.seasonStatus}
          receivedRequests={viewModel.tip.receivedRequests}
          sentRequests={viewModel.tip.sentRequests}
          activeChats={viewModel.tip.activeChats}
          unreadMessages={viewModel.tip.unreadMessages}
        />
      </section>
    );
  }

  const message = resolveStaticTip(viewModel, seasonState);

  return (
    <section className={sectionCard()} data-testid="home-status-tip">
      <div className={sectionHeader}>
        <h2 className="font-bold text-[var(--knu-text-primary)]">이용 안내</h2>
        <Info className="w-5 h-5 text-[var(--knu-primary)]" aria-hidden="true" />
      </div>
      <p className="text-sm leading-relaxed text-[var(--knu-text-secondary)]">{message}</p>
    </section>
  );
}

function resolveStaticTip(viewModel: HomeDashboardViewModel, seasonState: SeasonState): string {
  if (!viewModel.isCampusOperated) {
    return '운영 캠퍼스가 열리면 시즌 일정과 참여 상태를 이 홈 화면에서 안내합니다.';
  }
  if (!viewModel.hasCurrentSeason) {
    return '진행 중인 시즌이 없어도 프로필은 미리 정비할 수 있어요.';
  }
  if (seasonState === 'SEASON_OPEN') {
    return '등록 전에는 생활패턴과 건물 선택을 정비할 수 있고, 등록 후에는 시즌 프로필이 잠겨요.';
  }
  if (seasonState === 'SEASON_POST_MATCH') {
    return '시즌 마감 정리 기간에는 새 요청보다 결과 확인과 확정된 관계 안내가 우선입니다.';
  }
  return '비시즌에는 타인 탐색이 닫히고, 다음 시즌 준비와 이전 기록 확인을 중심으로 이용합니다.';
}
