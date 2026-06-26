'use client';

import { motion } from 'motion/react';
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  History,
  MessageCircle,
  Search,
} from 'lucide-react';
import { HomeMatchingSummary } from './HomeMatchingSummary';
import { sectionCard, sectionHeader } from '@/main/styles/home';
import type { SeasonState } from '@repo/shared/season/runtime';
import type { TabId, MatchingNavOptions } from '@/types/profile';
import type { HomeDashboardViewModel } from '../model/homeDashboardViewModel';

interface HomeActivityPanelProps {
  viewModel: HomeDashboardViewModel;
  seasonState: SeasonState;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  onOpenBuildingSelect?: () => void;
}

export function HomeActivityPanel({
  viewModel,
  seasonState,
  onNavigate,
  onOpenBuildingSelect,
}: HomeActivityPanelProps) {
  if (viewModel.hasCurrentSeason && seasonState === 'SEASON_MATCHING') {
    return (
      <HomeMatchingSummary
        status={viewModel.matchingSummary.status}
        stats={viewModel.matchingSummary.stats}
        activeMatch={viewModel.matchingSummary.activeMatch}
        receivedRequesters={viewModel.matchingSummary.receivedRequesters}
        gatingReason={viewModel.matchingSummary.gatingReason}
        onGatedAction={() => onOpenBuildingSelect?.()}
        onNavigate={onNavigate}
      />
    );
  }

  if (!viewModel.hasCurrentSeason) {
    return (
      <StaticActivityCard
        eyebrow="활동 대기"
        title="새 시즌이 열리면 활동이 표시돼요"
        body="현재는 새 매칭 요청이나 채팅 시작이 열려 있지 않아요. 프로필을 정비하며 다음 시즌을 기다려 주세요."
        icon={CalendarDays}
        actionLabel="내 프로필 확인"
        onAction={() => onNavigate('profile')}
      />
    );
  }

  if (seasonState === 'SEASON_OPEN') {
    return (
      <StaticActivityCard
        eyebrow="탐색 준비"
        title="후보 탐색은 준비 상태로 열려요"
        body="시즌 오픈 기간에는 프로필과 건물 선택을 준비하고, 매칭 요청은 매칭 기간에 시작돼요."
        icon={Search}
        actionLabel="프로필 정비하기"
        onAction={() => onNavigate('profile')}
      />
    );
  }

  if (seasonState === 'SEASON_POST_MATCH') {
    return (
      <StaticActivityCard
        eyebrow="결과 확인"
        title={
          viewModel.hasActiveMatch ? '확정 매칭 결과가 있어요' : '시즌 기록을 확인할 수 있어요'
        }
        body={
          viewModel.hasActiveMatch
            ? '현재 확정된 매칭 결과와 허용된 matched chat만 유지돼요. 새 탐색이나 새 매칭 요청은 열리지 않아요.'
            : '마감 정리 기간에는 새 매칭 요청이 아니라 이번 시즌 결과와 이전 기록을 확인하는 흐름이에요.'
        }
        icon={viewModel.hasActiveMatch ? MessageCircle : History}
        actionLabel="시즌 결과 보기"
        onAction={() => onNavigate('matching', { section: 'past' })}
        secondaryAction={
          viewModel.capabilities.canStartChat
            ? { label: '채팅 보기', onClick: () => onNavigate('chat') }
            : undefined
        }
      />
    );
  }

  return (
    <StaticActivityCard
      eyebrow="비시즌"
      title="이전 기록 중심으로 확인해요"
      body="비시즌에는 타인 탐색이 닫히고, 과거 매칭 기록과 내 프로필 정비만 이용할 수 있어요."
      icon={History}
      actionLabel={viewModel.capabilities.canViewMatchHistory ? '이전 기록 보기' : '내 프로필 확인'}
      onAction={() =>
        viewModel.capabilities.canViewMatchHistory
          ? onNavigate('matching', { section: 'past' })
          : onNavigate('profile')
      }
    />
  );
}

function StaticActivityCard({
  eyebrow,
  title,
  body,
  icon: Icon,
  actionLabel,
  onAction,
  secondaryAction,
}: {
  eyebrow: string;
  title: string;
  body: string;
  icon: React.ElementType;
  actionLabel: string;
  onAction: () => void;
  secondaryAction?: { label: string; onClick: () => void };
}) {
  return (
    <section className={sectionCard()} aria-labelledby="home-activity-title">
      <div className={sectionHeader}>
        <div>
          <p className="text-xs font-bold text-(--knu-primary) mb-1">{eyebrow}</p>
          <h2 id="home-activity-title" className="font-bold text-(--knu-text-primary)">
            {title}
          </h2>
        </div>
        <Icon className="w-5 h-5 text-(--knu-primary)" aria-hidden="true" />
      </div>
      <p className="text-sm leading-relaxed text-(--knu-text-secondary) mb-4">{body}</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <motion.button
          type="button"
          onClick={onAction}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="min-h-11 flex-1 rounded-xl bg-(--knu-background-alt) hover:bg-gray-100 border border-(--knu-border) px-4 py-2.5 text-sm font-bold text-(--knu-text-primary) transition-colors flex items-center justify-center gap-2"
        >
          <BarChart3 className="w-4 h-4" aria-hidden="true" />
          <span>{actionLabel}</span>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </motion.button>
        {secondaryAction && (
          <motion.button
            type="button"
            onClick={secondaryAction.onClick}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="min-h-11 flex-1 rounded-xl bg-white hover:bg-(--knu-background-alt) border border-(--knu-border) px-4 py-2.5 text-sm font-bold text-(--knu-text-primary) transition-colors flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            <span>{secondaryAction.label}</span>
          </motion.button>
        )}
      </div>
    </section>
  );
}
