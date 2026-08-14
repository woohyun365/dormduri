'use client';

import { History, UserRound } from 'lucide-react';
import { StaticActivityCard } from './StaticActivityCard';
import { HomeMatchingSummary } from '../matching/HomeMatchingSummary';
import { OffSeasonActivitySection } from './states/OffSeasonActivitySection';
import { PostMatchActivitySection } from './states/PostMatchActivitySection';
import { SeasonMatchingPreparationActivitySection } from './states/SeasonMatchingPreparationActivitySection';
import { SeasonOpenActivitySection } from './states/SeasonOpenActivitySection';
import type { HomeActivityPanelProps } from './model/activityTypes';

export function HomeActivityPanel({
  viewModel,
  seasonState,
  onNavigate,
  onDeregisterSeasonParticipation,
  onRequestActiveMatchUnmatch,
  onCancelActiveMatchUnmatchRequest,
}: HomeActivityPanelProps) {
  if (
    viewModel.hasCurrentSeason &&
    seasonState === 'SEASON_MATCHING' &&
    !viewModel.preparation.registrationReady
  ) {
    return (
      <SeasonMatchingPreparationActivitySection
        viewModel={viewModel}
        onNavigate={onNavigate}
        onDeregisterSeasonParticipation={onDeregisterSeasonParticipation}
      />
    );
  }

  if (viewModel.hasCurrentSeason && seasonState === 'SEASON_MATCHING') {
    const activeMatchRoomSelection = viewModel.matchingWindow
      ? {
          date: viewModel.matchingWindow.roomSelectionDateShort,
          dormitoryName: viewModel.matchingWindow.roomSelectionDormitoryName,
        }
      : undefined;

    return (
      <HomeMatchingSummary
        status={viewModel.matchingSummary.status}
        stats={viewModel.matchingSummary.stats}
        activeMatch={viewModel.matchingSummary.activeMatch}
        {...(activeMatchRoomSelection ? { activeMatchRoomSelection } : {})}
        receivedRequesters={viewModel.matchingSummary.receivedRequesters}
        gatingReason={viewModel.matchingSummary.gatingReason}
        onGatedAction={() => onNavigate('profile')}
        onRequestUnmatch={onRequestActiveMatchUnmatch}
        onCancelUnmatchRequest={onCancelActiveMatchUnmatchRequest}
        onNavigate={onNavigate}
      />
    );
  }

  if (!viewModel.hasCurrentSeason) {
    return <OffSeasonActivitySection viewModel={viewModel} />;
  }

  if (seasonState === 'SEASON_OPEN') {
    return (
      <SeasonOpenActivitySection
        viewModel={viewModel}
        onNavigate={onNavigate}
        onDeregisterSeasonParticipation={onDeregisterSeasonParticipation}
      />
    );
  }

  if (seasonState === 'SEASON_POST_MATCH') {
    return <PostMatchActivitySection viewModel={viewModel} onNavigate={onNavigate} />;
  }

  return (
    <StaticActivityCard
      eyebrow="비시즌"
      title="이전 기록 중심으로 확인해요"
      body="비시즌에는 타인 탐색과 새 매칭 요청이 닫혀요. 지금은 과거 매칭 기록과 내 정보 확인만 이용할 수 있어요."
      icon={History}
      action={{
        label: viewModel.capabilities.canViewMatchHistory ? '이전 기록 보기' : '내 정보 확인',
        onClick: () =>
          viewModel.capabilities.canViewMatchHistory
            ? onNavigate('matching', { section: 'past' })
            : onNavigate('profile'),
        icon: viewModel.capabilities.canViewMatchHistory ? History : UserRound,
        trailingIcon: true,
      }}
    />
  );
}
