'use client';

import { motion } from 'motion/react';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  History,
  Inbox,
  MessageCircle,
  Search,
  Send,
  UserRound,
  XCircle,
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
    const offSeasonActivity = resolveOffSeasonActivityContent(viewModel);

    return (
      <OffSeasonActivityCard
        viewModel={viewModel}
        content={offSeasonActivity}
        onNavigate={onNavigate}
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
        actionLabel="시즌 프로필 확인"
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
      body="비시즌에는 타인 탐색과 새 매칭 요청이 닫혀요. 지금은 과거 매칭 기록과 내 정보 확인만 이용할 수 있어요."
      icon={History}
      actionLabel={viewModel.capabilities.canViewMatchHistory ? '이전 기록 보기' : '내 정보 확인'}
      onAction={() =>
        viewModel.capabilities.canViewMatchHistory
          ? onNavigate('matching', { section: 'past' })
          : onNavigate('profile')
      }
    />
  );
}

function resolveOffSeasonActivityContent(viewModel: HomeDashboardViewModel): {
  eyebrow: string;
  title: string;
  body: string;
  icon: React.ElementType;
} {
  const lastSeason = viewModel.seasonSummary.lastSeason;

  if (!lastSeason) {
    return {
      eyebrow: '이전 시즌 활동 요약',
      title: '새 시즌이 열리면 활동이 표시돼요',
      body: '지금은 새 매칭 요청과 채팅 시작이 닫혀 있어요. 일정이 확정되면 필요한 행동을 홈에서 안내할게요.',
      icon: CalendarDays,
    };
  }

  if (!lastSeason.viewerHadRegistration) {
    return {
      eyebrow: '이전 시즌 활동 요약',
      title: '이전 시즌에 참여하지 않았어요',
      body: `지난 ${lastSeason.name} 시즌에는 참여 기록이 없어요. 다음 시즌이 열리면 참여해보세요.`,
      icon: History,
    };
  }

  return {
    eyebrow: '이전 시즌 활동 요약',
    title: resolveViewerActivityTitle(lastSeason.viewerActivity.finalResult),
    body: `보낸 요청 ${lastSeason.viewerActivity.sentRequestCount}건 · 받은 요청 ${lastSeason.viewerActivity.receivedRequestCount}건 · 대화 ${lastSeason.viewerActivity.conversationCount}건`,
    icon: lastSeason.viewerActivity.conversationCount > 0 ? MessageCircle : History,
  };
}

function OffSeasonActivityCard({
  viewModel,
  content,
  onNavigate,
}: {
  viewModel: HomeDashboardViewModel;
  content: ReturnType<typeof resolveOffSeasonActivityContent>;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
}) {
  const lastSeason = viewModel.seasonSummary.lastSeason;
  const Icon = content.icon;
  const isNoParticipationHistory = Boolean(lastSeason && !lastSeason.viewerHadRegistration);
  const primaryActionLabel = viewModel.capabilities.canViewMatchHistory
    ? '지난 기록 보기'
    : '내 정보 확인';
  const onPrimaryAction = () =>
    viewModel.capabilities.canViewMatchHistory
      ? onNavigate('matching', { section: 'past' })
      : onNavigate('profile');

  return (
    <section className={sectionCard()} aria-labelledby="home-activity-title">
      <div className={sectionHeader}>
        <div>
          <p className="mb-1 text-xs font-bold text-(--knu-primary)">{content.eyebrow}</p>
          <h2 id="home-activity-title" className="font-bold text-(--knu-text-primary)">
            {content.title}
          </h2>
        </div>
        <Icon className="h-5 w-5 text-(--knu-primary)" aria-hidden="true" />
      </div>

      {lastSeason?.viewerHadRegistration ? (
        <div className="space-y-3">
          <ViewerResultCard
            finalResult={lastSeason.viewerActivity.finalResult}
            matchedPartnerNickname={lastSeason.viewerActivity.matchedPartnerNickname}
          />
          <div className="grid grid-cols-3 gap-2">
            <ActivityStatCell
              icon={Inbox}
              label="받은 요청"
              value={lastSeason.viewerActivity.receivedRequestCount}
              tone="purple"
            />
            <ActivityStatCell
              icon={Send}
              label="보낸 요청"
              value={lastSeason.viewerActivity.sentRequestCount}
              tone="blue"
            />
            <ActivityStatCell
              icon={MessageCircle}
              label="대화"
              value={lastSeason.viewerActivity.conversationCount}
              tone="green"
            />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-(--knu-text-secondary)">
          {content.body}
        </div>
      )}

      {!isNoParticipationHistory && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <motion.button
            type="button"
            onClick={onPrimaryAction}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-(--knu-border) bg-(--knu-background-alt) px-4 py-2.5 text-sm font-bold text-(--knu-text-primary) transition-colors hover:bg-gray-100"
          >
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            <span>{primaryActionLabel}</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </motion.button>
          {viewModel.capabilities.canViewMatchHistory && (
            <motion.button
              type="button"
              onClick={() => onNavigate('profile')}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-(--knu-border) bg-white px-4 py-2.5 text-sm font-bold text-(--knu-text-primary) transition-colors hover:bg-(--knu-background-alt)"
            >
              <UserRound className="h-4 w-4" aria-hidden="true" />
              <span>내 정보 확인</span>
            </motion.button>
          )}
        </div>
      )}
    </section>
  );
}

function ViewerResultCard({
  finalResult,
  matchedPartnerNickname,
}: {
  finalResult: NonNullable<
    HomeDashboardViewModel['seasonSummary']['lastSeason']
  >['viewerActivity']['finalResult'];
  matchedPartnerNickname: string | null;
}) {
  const matched = finalResult === 'MATCHED' || finalResult === 'UNMATCHED_AFTER_SUCCESS';
  const ResultIcon = matched ? CheckCircle2 : XCircle;

  return (
    <div
      className={
        matched
          ? 'rounded-xl border border-green-200 bg-green-50 p-4'
          : 'rounded-xl border border-gray-200 bg-gray-50 p-4'
      }
    >
      <div className="mb-2 flex items-center gap-2">
        <ResultIcon
          className={matched ? 'h-5 w-5 text-green-600' : 'h-5 w-5 text-gray-500'}
          aria-hidden="true"
        />
        <span className={matched ? 'font-bold text-green-700' : 'font-bold text-gray-700'}>
          {matched ? '매칭 완료' : '매칭 미성사'}
        </span>
      </div>
      <p className={matched ? 'text-sm text-green-800' : 'text-sm text-gray-600'}>
        {matched ? (
          matchedPartnerNickname ? (
            <>
              <span className="font-extrabold text-green-700">{matchedPartnerNickname}</span>님과
              매칭이 성사되었어요.
            </>
          ) : (
            '지난 시즌에 매칭이 성사되었어요.'
          )
        ) : (
          '지난 시즌에는 확정된 매칭이 없었어요.'
        )}
      </p>
    </div>
  );
}

function ActivityStatCell({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone: 'purple' | 'blue' | 'green';
}) {
  const toneClass = {
    purple: {
      icon: 'bg-purple-100 text-purple-600',
      value: 'text-purple-600',
    },
    blue: {
      icon: 'bg-blue-100 text-blue-600',
      value: 'text-blue-600',
    },
    green: {
      icon: 'bg-green-100 text-green-600',
      value: 'text-green-600',
    },
  }[tone];

  return (
    <div className="rounded-xl bg-(--knu-background-alt) p-3 text-center">
      <div
        className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full ${toneClass.icon}`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <p className={`text-lg font-bold ${toneClass.value}`}>{value}</p>
      <p className="text-xs text-(--knu-text-tertiary)">{label}</p>
    </div>
  );
}

function resolveViewerActivityTitle(
  finalResult: NonNullable<
    HomeDashboardViewModel['seasonSummary']['lastSeason']
  >['viewerActivity']['finalResult'],
): string {
  switch (finalResult) {
    case 'MATCHED':
      return '이전 시즌에 매칭이 확정됐어요';
    case 'UNMATCHED_AFTER_SUCCESS':
      return '지난 시즌 매칭 종료 기록이 있어요';
    case 'NO_MATCH':
      return '이전 시즌 참여 기록이 있어요';
    case 'NOT_PARTICIPATED':
      return '이전 시즌에 참여하지 않았어요';
  }
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
  secondaryAction?: { label: string; onClick: () => void; icon?: React.ElementType };
}) {
  const SecondaryIcon = secondaryAction?.icon ?? MessageCircle;

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
            <SecondaryIcon className="w-4 h-4" aria-hidden="true" />
            <span>{secondaryAction.label}</span>
          </motion.button>
        )}
      </div>
    </section>
  );
}
