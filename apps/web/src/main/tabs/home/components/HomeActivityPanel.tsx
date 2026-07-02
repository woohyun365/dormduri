'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import {
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardCheck,
  CheckCircle2,
  ChevronRight,
  History,
  Inbox,
  ListChecks,
  MessageCircle,
  Search,
  Send,
  UserRound,
  XCircle,
} from 'lucide-react';
import { HomeMatchingSummary } from './HomeMatchingSummary';
import { HomeResponsiveSheet } from '../overlays/HomeResponsiveSheet';
import { sectionCard, sectionHeader } from '@/main/styles/home';
import type { SeasonState } from '@repo/shared/season/runtime';
import type { TabId, MatchingNavOptions } from '@/types/profile';
import type { HomeDashboardViewModel } from '../model/homeDashboardViewModel';

interface HomeActivityPanelProps {
  viewModel: HomeDashboardViewModel;
  seasonState: SeasonState;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  onDeregisterSeasonParticipation?: () => Promise<void>;
  onRequestActiveMatchUnmatch?: (activeMatchId: string) => Promise<void>;
  onCancelActiveMatchUnmatchRequest?: (activeMatchId: string) => Promise<void>;
}

interface StaticActivityAction {
  label: string;
  onClick: () => void;
  icon?: React.ElementType;
  trailingIcon?: boolean;
  emphasis?: 'primary' | 'secondary';
  buttonTone?: StaticActivityTone;
}

type StaticActivityTone =
  | 'default'
  | 'openRequired'
  | 'openReady'
  | 'openRegistered'
  | 'openWaiting'
  | 'postMatch'
  | 'postMatchMatched';

type SeasonOpenModalKind =
  | 'profile-composition'
  | 'registration-confirmation'
  | 'withdrawal-policy'
  | 'profile-view';

interface StaticActivityMetric {
  label: string;
  value: string;
  helper: string;
  icon: React.ElementType;
  tone?: 'neutral' | 'participant' | 'buildingOpen' | 'buildingLocked' | 'matchSuccess' | 'result';
  todayNewCount?: number;
  onClick?: () => void;
}

export function HomeActivityPanel({
  viewModel,
  seasonState,
  onNavigate,
  onDeregisterSeasonParticipation,
  onRequestActiveMatchUnmatch,
  onCancelActiveMatchUnmatchRequest,
}: HomeActivityPanelProps) {
  const [isOperatedDormitoryListOpen, setOperatedDormitoryListOpen] = useState(false);
  const [seasonOpenModal, setSeasonOpenModal] = useState<SeasonOpenModalKind | null>(null);

  if (
    viewModel.hasCurrentSeason &&
    seasonState === 'SEASON_MATCHING' &&
    !viewModel.preparation.registrationReady
  ) {
    const seasonMatchingPreparationActivity = resolveSeasonOpenActivityContent({
      viewModel,
      onNavigate,
      onOpenOperatedDormitoryList: () => setOperatedDormitoryListOpen(true),
      onOpenSeasonOpenModal: setSeasonOpenModal,
    });

    return (
      <>
        <StaticActivityCard {...seasonMatchingPreparationActivity} />
        <OperatedDormitoryListModal
          isOpen={isOperatedDormitoryListOpen}
          viewModel={viewModel}
          onClose={() => setOperatedDormitoryListOpen(false)}
        />
        <SeasonOpenActionModal
          kind={seasonOpenModal}
          viewModel={viewModel}
          onNavigate={onNavigate}
          onDeregisterSeasonParticipation={onDeregisterSeasonParticipation}
          onClose={() => setSeasonOpenModal(null)}
        />
      </>
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
    const offSeasonActivity = resolveOffSeasonActivityContent(viewModel);

    return <OffSeasonActivityCard viewModel={viewModel} content={offSeasonActivity} />;
  }

  if (seasonState === 'SEASON_OPEN') {
    const seasonOpenActivity = resolveSeasonOpenActivityContent({
      viewModel,
      onNavigate,
      onOpenOperatedDormitoryList: () => setOperatedDormitoryListOpen(true),
      onOpenSeasonOpenModal: setSeasonOpenModal,
    });

    return (
      <>
        <StaticActivityCard {...seasonOpenActivity} />
        <OperatedDormitoryListModal
          isOpen={isOperatedDormitoryListOpen}
          viewModel={viewModel}
          onClose={() => setOperatedDormitoryListOpen(false)}
        />
        <SeasonOpenActionModal
          kind={seasonOpenModal}
          viewModel={viewModel}
          onNavigate={onNavigate}
          onDeregisterSeasonParticipation={onDeregisterSeasonParticipation}
          onClose={() => setSeasonOpenModal(null)}
        />
      </>
    );
  }

  if (seasonState === 'SEASON_POST_MATCH') {
    const postMatchActivity = resolvePostMatchActivityContent({ viewModel, onNavigate });

    return (
      <PostMatchActivityCard
        viewModel={viewModel}
        content={postMatchActivity}
        onNavigate={onNavigate}
      />
    );
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

type PostMatchActivityOutcome =
  | 'not-registered'
  | 'deregistered'
  | 'matched'
  | 'unmatched-after-success'
  | 'not-matched'
  | 'history';

function resolvePostMatchActivityContent({
  viewModel,
  onNavigate,
}: {
  viewModel: HomeDashboardViewModel;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
}): {
  eyebrow: string;
  title: string;
  body?: string;
  icon: React.ElementType;
  tone?: StaticActivityTone;
  metrics?: StaticActivityMetric[];
  action?: StaticActivityAction;
  secondaryAction?: StaticActivityAction;
  outcome: PostMatchActivityOutcome;
} {
  const outcome = resolvePostMatchActivityOutcome(viewModel);
  const metrics = buildPostMatchActivityMetrics({ viewModel, outcome, onNavigate });

  if (outcome === 'matched') {
    return {
      eyebrow: '이번 시즌 활동 요약',
      title: '이번 시즌 활동 기록을 확인해요',
      icon: BarChart3,
      tone: 'postMatchMatched',
      outcome,
      metrics,
    };
  }

  if (outcome === 'not-registered') {
    return {
      eyebrow: '이번 시즌 활동 요약',
      title: '이번 시즌에 참여하지 않았어요',
      icon: BarChart3,
      tone: 'postMatch',
      outcome,
      metrics,
    };
  }

  if (outcome === 'deregistered') {
    return {
      eyebrow: '이번 시즌 활동 요약',
      title: '이번 시즌 참여를 철회했어요',
      icon: BarChart3,
      tone: 'postMatch',
      outcome,
      metrics,
    };
  }

  if (outcome === 'unmatched-after-success') {
    return {
      eyebrow: '이번 시즌 활동 요약',
      title: '이번 시즌 활동 기록을 확인해요',
      icon: BarChart3,
      tone: 'postMatch',
      outcome,
      metrics,
    };
  }

  return {
    eyebrow: '이번 시즌 활동 요약',
    title: '이번 시즌 활동 기록을 확인해요',
    icon: BarChart3,
    tone: 'postMatch',
    outcome,
    metrics,
  };
}

function resolvePostMatchActivityOutcome(
  viewModel: HomeDashboardViewModel,
): PostMatchActivityOutcome {
  const reasons = viewModel.preparation.registrationUnavailableReasons;
  const lastSeason = viewModel.seasonSummary.lastSeason;

  if (viewModel.hasActiveMatch) return 'matched';
  if (reasons.includes('WITHDRAWN_OR_DECLINED_LOCK')) return 'deregistered';
  if (!viewModel.preparation.registrationReady && !lastSeason?.viewerHadRegistration) {
    return 'not-registered';
  }
  if (lastSeason?.viewerActivity.finalResult === 'UNMATCHED_AFTER_SUCCESS') {
    return 'unmatched-after-success';
  }
  if (lastSeason?.viewerActivity.finalResult === 'NO_MATCH') return 'not-matched';

  return 'history';
}

function buildPostMatchActivityMetrics({
  viewModel,
  outcome,
  onNavigate,
}: {
  viewModel: HomeDashboardViewModel;
  outcome: PostMatchActivityOutcome;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
}): StaticActivityMetric[] {
  if (outcome === 'matched') {
    return [
      {
        label: '매칭 상대',
        value: viewModel.activeMatch?.partnerNickname ?? '상대',
        helper: '결과 확인 가능',
        icon: CheckCircle2,
        tone: 'matchSuccess',
      },
      {
        label: '채팅',
        value: viewModel.capabilities.canStartChat ? '가능' : '닫힘',
        helper: viewModel.capabilities.canStartChat ? '시즌 종료 전까지' : '정책에 따라 제한',
        icon: MessageCircle,
        tone: viewModel.capabilities.canStartChat ? 'buildingOpen' : 'neutral',
      },
      {
        label: '시즌 종료',
        value: viewModel.daysUntilEnd > 0 ? `D-${viewModel.daysUntilEnd}` : '오늘',
        helper: '이후 과거 기록 정리',
        icon: CalendarDays,
        tone: 'result',
      },
    ];
  }

  const activity = viewModel.seasonSummary.lastSeason?.viewerActivity;
  if (activity && viewModel.seasonSummary.lastSeason?.viewerHadRegistration) {
    return [
      {
        label: '보낸 요청',
        value: `${activity.sentRequestCount}건`,
        helper: '보낸 요청 보기',
        icon: Send,
        tone: 'participant',
        onClick: () => onNavigate('matching', { requestTab: 'sent' }),
      },
      {
        label: '받은 요청',
        value: `${activity.receivedRequestCount}건`,
        helper: '받은 요청 보기',
        icon: Inbox,
        tone: 'result',
        onClick: () => onNavigate('matching', { requestTab: 'received' }),
      },
      {
        label: '대화',
        value: `${activity.conversationCount}건`,
        helper: '대화 기록 보기',
        icon: MessageCircle,
        tone: 'buildingOpen',
        onClick: () => onNavigate('matching', { section: 'current' }),
      },
    ];
  }

  return [
    {
      label: '참여 상태',
      value: outcome === 'deregistered' ? '철회' : '미참여',
      helper: outcome === 'deregistered' ? '시즌 참여 종료' : '이번 시즌 기록 없음',
      icon: UserRound,
      tone: 'neutral',
    },
    {
      label: '새 요청',
      value: '닫힘',
      helper: '매칭 시즌 종료',
      icon: Send,
      tone: 'neutral',
    },
    {
      label: '새 채팅',
      value: '닫힘',
      helper: '매칭 시즌 종료',
      icon: MessageCircle,
      tone: 'neutral',
    },
  ];
}

const SEASON_OPEN_ACTIVITY_EYEBROW = '탐색 준비';

function resolveSeasonOpenActivityContent({
  viewModel,
  onNavigate,
  onOpenOperatedDormitoryList,
  onOpenSeasonOpenModal,
}: {
  viewModel: HomeDashboardViewModel;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  onOpenOperatedDormitoryList: () => void;
  onOpenSeasonOpenModal: (kind: SeasonOpenModalKind) => void;
}): {
  eyebrow: string;
  title: string;
  body?: string;
  icon: React.ElementType;
  tone?: StaticActivityTone;
  metrics?: StaticActivityMetric[];
  action?: StaticActivityAction;
  secondaryAction?: StaticActivityAction;
} {
  const reasons = viewModel.preparation.registrationUnavailableReasons;
  const needsSeasonProfile = !viewModel.preparation.hasSeasonProfile;
  const needsDormitory = !viewModel.preparation.hasBuilding;
  const overviewMetrics = buildSeasonOpenExplorationMetrics({
    viewModel,
    canUseSameDormitory:
      viewModel.preparation.registrationReady && viewModel.capabilities.canEnterRoommateSearch,
    onOpenOperatedDormitoryList,
  });
  const profileAction: StaticActivityAction = {
    label: '시즌 프로필/기숙사 설정',
    onClick: () => onNavigate('profile'),
    icon: UserRound,
    trailingIcon: true,
  };
  const noOperatedDormitoryProfileAction: StaticActivityAction = {
    label: '시즌 프로필 설정',
    onClick: () => onNavigate('profile'),
    icon: UserRound,
    trailingIcon: true,
  };
  const profileCompositionAction: StaticActivityAction = {
    label: '시즌 프로필 구성 확인',
    onClick: () => onOpenSeasonOpenModal('profile-composition'),
    icon: ListChecks,
  };
  const profileReviewAction: StaticActivityAction = {
    label: '시즌 프로필 보기',
    onClick: () => onOpenSeasonOpenModal('profile-view'),
    icon: UserRound,
  };

  if (reasons.includes('NO_SELECTABLE_DORMITORY')) {
    return {
      eyebrow: SEASON_OPEN_ACTIVITY_EYEBROW,
      title: '이번 시즌 현황',
      icon: Search,
      tone: 'openWaiting',
      metrics: overviewMetrics,
      action: needsSeasonProfile ? noOperatedDormitoryProfileAction : undefined,
    };
  }

  if (viewModel.preparation.registrationReady && viewModel.capabilities.canEnterRoommateSearch) {
    return {
      eyebrow: SEASON_OPEN_ACTIVITY_EYEBROW,
      title: '이번 시즌 현황',
      icon: Search,
      tone: 'openRegistered',
      metrics: overviewMetrics,
      action: {
        ...profileReviewAction,
        emphasis: 'secondary',
        buttonTone: 'openReady',
      },
      secondaryAction: {
        label: '시즌 참여 철회하기',
        onClick: () => onOpenSeasonOpenModal('withdrawal-policy'),
        icon: XCircle,
        emphasis: 'secondary',
      },
    };
  }

  if (viewModel.preparation.registrationReady) {
    return {
      eyebrow: SEASON_OPEN_ACTIVITY_EYEBROW,
      title: '이번 시즌 현황',
      icon: Search,
      tone: 'openRegistered',
      metrics: overviewMetrics,
      action: {
        ...profileReviewAction,
        emphasis: 'secondary',
        buttonTone: 'openReady',
      },
    };
  }

  if (!viewModel.preparation.registrationReady && reasons.length === 0) {
    return {
      eyebrow: SEASON_OPEN_ACTIVITY_EYEBROW,
      title: '이번 시즌 현황',
      icon: Search,
      tone: 'openReady',
      metrics: overviewMetrics,
      action: {
        ...profileAction,
        emphasis: 'secondary',
      },
      secondaryAction: {
        label: '시즌 참여 신청하기',
        onClick: () => onOpenSeasonOpenModal('registration-confirmation'),
        icon: ClipboardCheck,
        emphasis: 'primary',
      },
    };
  }

  if (needsSeasonProfile || needsDormitory) {
    return {
      eyebrow: SEASON_OPEN_ACTIVITY_EYEBROW,
      title: '이번 시즌 현황',
      icon: Search,
      tone: 'openRequired',
      metrics: overviewMetrics,
      action: profileAction,
      secondaryAction: viewModel.preparation.canSelectBuilding
        ? profileCompositionAction
        : undefined,
    };
  }

  if (reasons.includes('DORMITORY_SELECTION_CLOSED')) {
    return {
      eyebrow: SEASON_OPEN_ACTIVITY_EYEBROW,
      title: '이번 시즌 현황',
      icon: Search,
      tone: 'openWaiting',
      metrics: overviewMetrics,
      action: profileReviewAction,
    };
  }

  return {
    eyebrow: SEASON_OPEN_ACTIVITY_EYEBROW,
    title: '이번 시즌 현황',
    icon: Search,
    tone: 'openWaiting',
    metrics: overviewMetrics,
    action: reasons.includes('DORMITORY_SELECTION_REQUIRED')
      ? profileCompositionAction
      : profileReviewAction,
  };
}

function buildSeasonOpenExplorationMetrics({
  viewModel,
  canUseSameDormitory,
  onOpenOperatedDormitoryList,
}: {
  viewModel: HomeDashboardViewModel;
  canUseSameDormitory: boolean;
  onOpenOperatedDormitoryList: () => void;
}): StaticActivityMetric[] {
  const operatedDormitoryCount = viewModel.operatedDormitories.length;

  return [
    {
      label: '이번 시즌 참여자',
      value: formatPersonCount(viewModel.statsBar.totalCount),
      helper: `${viewModel.campusName} 기준`,
      icon: UserRound,
      tone: 'participant',
      todayNewCount: viewModel.statsBar.todayNewTotal,
    },
    {
      label: '내 건물 참여자',
      value: canUseSameDormitory ? formatPersonCount(viewModel.statsBar.buildingCount) : '-',
      helper: canUseSameDormitory
        ? `${viewModel.dormitory?.name ?? '내 건물'} 기준`
        : '시즌 참여 시 공개',
      icon: Building2,
      tone: canUseSameDormitory ? 'buildingOpen' : 'buildingLocked',
      todayNewCount: canUseSameDormitory ? viewModel.statsBar.todayNewBuilding : 0,
    },
    {
      label: '운영 기숙사 리스트',
      value: `${operatedDormitoryCount}곳`,
      helper: '클릭 시 확인 가능',
      icon: ListChecks,
      tone: 'neutral',
      onClick: onOpenOperatedDormitoryList,
    },
  ];
}

function formatPersonCount(count: number): string {
  return `${Math.max(0, count)}명`;
}

function resolveOffSeasonActivityContent(viewModel: HomeDashboardViewModel): {
  eyebrow: string;
  title: string;
  body?: string;
  icon: React.ElementType;
} {
  const lastSeason = viewModel.seasonSummary.lastSeason;

  if (!lastSeason) {
    return {
      eyebrow: '이전 시즌 활동 요약',
      title: '새 시즌이 열리면 활동이 표시돼요',
      body: '아직 시작된 시즌이 없어요.\n시즌 일정이 등록되면 참여 방법을 안내할게요.',
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

function OperatedDormitoryListModal({
  isOpen,
  viewModel,
  onClose,
}: {
  isOpen: boolean;
  viewModel: HomeDashboardViewModel;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <HomeResponsiveSheet
      eyebrow="시즌 오픈"
      title="운영 기숙사 리스트"
      description="이번 시즌에 선택할 수 있는 기숙사와 호실 선택 기준일이에요."
      icon={Building2}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 flex-1 rounded-xl bg-(--knu-primary) px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-(--knu-primary-dark)"
        >
          확인
        </button>
      }
    >
      {viewModel.operatedDormitories.length > 0 ? (
        <div className="space-y-2">
          {viewModel.operatedDormitories.map((dormitory) => (
            <div
              key={dormitory.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-(--knu-text-primary)">
                  {dormitory.name}
                </p>
                <p className="mt-0.5 text-xs text-(--knu-text-tertiary)">
                  호실 선택일 {dormitory.roomSelectionDate}
                </p>
              </div>
              <Building2 className="size-4 shrink-0 text-sky-600" aria-hidden="true" />
            </div>
          ))}
        </div>
      ) : (
        <EmptyDetailCard message="아직 등록된 운영 기숙사 정보가 없어요." />
      )}
    </HomeResponsiveSheet>
  );
}

function SeasonOpenActionModal({
  kind,
  viewModel,
  onNavigate,
  onDeregisterSeasonParticipation,
  onClose,
}: {
  kind: SeasonOpenModalKind | null;
  viewModel: HomeDashboardViewModel;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  onDeregisterSeasonParticipation?: () => Promise<void>;
  onClose: () => void;
}) {
  const [isSubmitting, setSubmitting] = useState(false);

  if (!kind) return null;

  const content = getSeasonOpenModalContent(kind, viewModel);
  const SummaryIcon = content.icon;
  const canRunDestructiveAction =
    Boolean(content.destructiveActionLabel) && Boolean(onDeregisterSeasonParticipation);

  const navigateToProfile = () => {
    onClose();
    onNavigate('profile');
  };

  const handleDestructiveAction = async () => {
    if (!onDeregisterSeasonParticipation || !content.destructiveActionLabel) return;

    setSubmitting(true);
    let shouldClose = false;
    try {
      await onDeregisterSeasonParticipation();
      shouldClose = true;
    } catch {
      // Parent action owns the user-facing error toast; keep the modal open for retry.
    } finally {
      setSubmitting(false);
    }

    if (shouldClose) {
      onClose();
    }
  };

  return (
    <HomeResponsiveSheet
      eyebrow={content.eyebrow}
      title={content.title}
      description={content.description}
      icon={content.icon}
      onClose={onClose}
      footer={
        <>
          {content.showProfileAction && (
            <button
              type="button"
              onClick={navigateToProfile}
              className="min-h-11 flex-1 rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-sm font-bold text-sky-900 transition-colors hover:bg-sky-50"
            >
              시즌 프로필/기숙사 설정
            </button>
          )}
          {content.destructiveActionLabel && (
            <button
              type="button"
              onClick={handleDestructiveAction}
              disabled={!canRunDestructiveAction || isSubmitting}
              className="min-h-11 flex-1 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? '처리 중...' : content.destructiveActionLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-xl bg-(--knu-primary) px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-(--knu-primary-dark)"
          >
            확인
          </button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700 ring-1 ring-sky-100">
          <SummaryIcon className="size-5" aria-hidden="true" />
        </span>
        <p className="text-sm leading-relaxed whitespace-pre-line text-sky-900">
          {content.summary}
        </p>
      </div>

      <div className="space-y-2">
        {content.rows.map((row) => (
          <DetailRow key={row.label} label={row.label} value={row.value} />
        ))}
      </div>

      {content.notes.length > 0 && (
        <div className="mt-4 space-y-2">
          {content.notes.map((note) => (
            <div
              key={note}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-(--knu-text-secondary)"
            >
              {note}
            </div>
          ))}
        </div>
      )}
    </HomeResponsiveSheet>
  );
}

function getSeasonOpenModalContent(
  kind: SeasonOpenModalKind,
  viewModel: HomeDashboardViewModel,
): {
  eyebrow: string;
  title: string;
  description: string;
  summary: string;
  icon: React.ElementType;
  rows: Array<{ label: string; value: string }>;
  notes: string[];
  showProfileAction: boolean;
  destructiveActionLabel?: string;
} {
  const rows = buildSeasonProfileCompositionRows(viewModel);

  switch (kind) {
    case 'profile-composition':
      return {
        eyebrow: '구성 확인',
        title: '시즌 프로필 구성을 확인해요',
        description:
          '시즌 참여 전에 필요한 생활패턴, 룸메 조건, 기숙사 설정 상태를 한 번에 확인해요.',
        summary:
          '기숙사 설정은 프로필 탭에서 관리해요.\n홈에서는 현재 구성 상태를 확인하는 역할만 해요.',
        icon: ListChecks,
        rows,
        notes: [
          '시즌 프로필과 기숙사는 서로 독립적으로 준비할 수 있고, 신청 전까지 수정할 수 있어요.',
        ],
        showProfileAction: true,
      };
    case 'registration-confirmation':
      return {
        eyebrow: '신청 전 확인',
        title: '시즌 참여 신청 전 확인',
        description: '현재 입력된 시즌 프로필과 기숙사 설정을 확인한 뒤 시즌 참여 신청을 진행해요.',
        summary: '신청을 완료하면 같은 기숙사 룸메 후보에게 내 시즌 프로필이 표시돼요.',
        icon: ClipboardCheck,
        rows: [...rows, { label: '신청 상태', value: '신청 가능' }],
        notes: [
          '신청 완료 후에는 이번 시즌 기준으로 시즌 프로필과 기숙사 설정이 잠겨요.',
          '매칭 신청은 매칭 기간에 열리고, 시즌 오픈 기간에는 같은 기숙사 후보 확인과 대화가 가능해요.',
        ],
        showProfileAction: true,
      };
    case 'withdrawal-policy':
      return {
        eyebrow: '철회 안내',
        title: '시즌 참여 철회 정책',
        description:
          '철회는 현재 시즌 참여 상태와 대화/요청 흐름에 영향을 주므로 정책을 먼저 확인해주세요.',
        summary: '철회하면 이번 시즌 참여자 풀에서 빠지고 같은 시즌 재참여가 제한돼요.',
        icon: XCircle,
        rows: [
          { label: '현재 상태', value: '시즌 참여 완료' },
          { label: '철회 가능 시점', value: '시즌 오픈·매칭 기간' },
          { label: '재참여', value: '같은 시즌 재참여 불가' },
        ],
        notes: [
          '철회 시 진행 중인 요청과 비매칭 대화는 철회 상태로 정리돼요.',
          '이미 확정된 매칭이 있으면 사용자가 직접 철회할 수 없고 별도 안내가 필요해요.',
        ],
        showProfileAction: false,
        destructiveActionLabel: '시즌 참여 철회하기',
      };
    case 'profile-view':
      return {
        eyebrow: '시즌 프로필',
        title: '이번 시즌 프로필 보기',
        description: '같은 기숙사 룸메 후보에게 표시되는 이번 시즌 기준 정보를 확인해요.',
        summary: '신청한 시즌 프로필과 기숙사 설정이 이번 시즌 탐색 기준으로 사용돼요.',
        icon: UserRound,
        rows: [
          { label: '닉네임', value: viewModel.viewerIdentity.nickname },
          { label: '성별', value: viewModel.viewerIdentity.genderLabel },
          { label: '캠퍼스', value: viewModel.viewerIdentity.campusName },
          { label: '기숙사', value: resolveDormitoryLabel(viewModel) },
        ],
        notes: ['등록 완료 후에는 시즌 프로필과 기숙사 설정을 홈에서 직접 수정하지 않아요.'],
        showProfileAction: false,
      };
  }
}

function buildSeasonProfileCompositionRows(
  viewModel: HomeDashboardViewModel,
): Array<{ label: string; value: string }> {
  const profileValue = viewModel.preparation.hasSeasonProfile ? '준비 완료' : '설정 필요';

  return [
    { label: '생활패턴', value: profileValue },
    { label: '룸메 조건', value: profileValue },
    { label: '기숙사', value: resolveDormitoryLabel(viewModel) },
  ];
}

function resolveDormitoryLabel(viewModel: HomeDashboardViewModel): string {
  if (viewModel.dormitory) return viewModel.dormitory.name;
  if (viewModel.preparation.registrationUnavailableReasons.includes('NO_SELECTABLE_DORMITORY')) {
    return '운영 정보 대기';
  }
  return viewModel.preparation.hasBuilding ? '설정 완료' : '설정 필요';
}

type PostMatchDetailModalKind = 'activity' | 'profile';

function PostMatchActivityCard({
  viewModel,
  content,
  onNavigate,
}: {
  viewModel: HomeDashboardViewModel;
  content: ReturnType<typeof resolvePostMatchActivityContent>;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
}) {
  const [detailModal, setDetailModal] = useState<PostMatchDetailModalKind | null>(null);
  const Icon = content.icon;
  const canShowDetailActions =
    content.outcome !== 'not-registered' && content.outcome !== 'matched';

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

      {content.outcome === 'matched' ? (
        <PostMatchMatchedSummaryCard viewModel={viewModel} onNavigate={onNavigate} />
      ) : (
        content.metrics &&
        content.metrics.length > 0 && <PostMatchActivityMetricGrid metrics={content.metrics} />
      )}

      {canShowDetailActions && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <PostMatchActivityButton
            icon={BarChart3}
            label="이번 시즌 상세 보기"
            variant="primary"
            onClick={() => setDetailModal('activity')}
          />
          <PostMatchActivityButton
            icon={UserRound}
            label="이번 시즌 프로필 확인"
            variant="secondary"
            onClick={() => setDetailModal('profile')}
          />
        </div>
      )}

      <PostMatchDetailModal
        kind={detailModal}
        viewModel={viewModel}
        onClose={() => setDetailModal(null)}
      />
    </section>
  );
}

function PostMatchActivityMetricGrid({ metrics }: { metrics: StaticActivityMetric[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {metrics.map((metric) => (
        <PostMatchActivityMetricCell key={metric.label} metric={metric} />
      ))}
    </div>
  );
}

function PostMatchActivityMetricCell({ metric }: { metric: StaticActivityMetric }) {
  const MetricIcon = metric.icon;
  const tone = resolvePostMatchMetricTone(metric);
  const toneClassName = {
    purple: {
      card: 'bg-(--knu-background-alt) hover:bg-purple-50',
      icon: 'bg-purple-100 text-purple-600',
      value: 'text-purple-600',
    },
    amber: {
      card: 'bg-(--knu-background-alt) hover:bg-amber-50',
      icon: 'bg-amber-100 text-amber-600',
      value: 'text-amber-600',
    },
    teal: {
      card: 'bg-(--knu-background-alt) hover:bg-teal-50',
      icon: 'bg-teal-100 text-teal-600',
      value: 'text-teal-600',
    },
    slate: {
      card: 'bg-(--knu-background-alt) hover:bg-slate-50',
      icon: 'bg-slate-100 text-slate-600',
      value: 'text-slate-700',
    },
  }[tone];
  const content = (
    <>
      <div
        className={`mb-2 flex size-10 items-center justify-center rounded-full transition-transform group-hover:scale-110 ${toneClassName.icon}`}
      >
        <MetricIcon className="size-5" aria-hidden="true" />
      </div>
      <span className={`text-lg font-bold ${toneClassName.value}`}>{metric.value}</span>
      <span className="mt-0.5 text-xs font-medium text-(--knu-text-tertiary)">{metric.label}</span>
      <span className={`mt-0.5 text-[10px] ${toneClassName.value}`}>{metric.helper}</span>
    </>
  );
  const className = `group relative flex flex-col items-center rounded-xl p-3 text-center transition-colors ${toneClassName.card}`;

  if (metric.onClick) {
    return (
      <motion.button
        type="button"
        onClick={metric.onClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={className}
      >
        {content}
      </motion.button>
    );
  }

  return <div className={className}>{content}</div>;
}

function resolvePostMatchMetricTone(
  metric: StaticActivityMetric,
): 'purple' | 'amber' | 'teal' | 'slate' {
  if (metric.label.includes('받은')) return 'purple';
  if (metric.label.includes('보낸')) return 'amber';
  if (metric.label.includes('대화')) return 'teal';
  return 'slate';
}

function PostMatchMatchedSummaryCard({
  viewModel,
  onNavigate,
}: {
  viewModel: HomeDashboardViewModel;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
}) {
  const [isProfileOpen, setProfileOpen] = useState(false);
  const activeMatch = viewModel.matchingSummary.activeMatch;
  const nickname = activeMatch?.nickname ?? viewModel.activeMatch?.partnerNickname ?? '상대';
  const matchScore = activeMatch?.matchScore ?? viewModel.activeMatch?.matchScore ?? 0;

  return (
    <div className="rounded-3xl border border-emerald-100 bg-linear-to-br from-emerald-50 via-white to-cyan-50 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/20">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-emerald-700">현재 매칭 상대</p>
          <h3 className="mt-0.5 truncate text-xl font-extrabold text-(--knu-text-primary)">
            {nickname}
          </h3>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <PostMatchMatchedMetric
          icon={UserRound}
          label="매칭도"
          value={`${matchScore}%`}
          helper="프로필 기준"
          tone="emerald"
        />
        <PostMatchMatchedMetric
          icon={CalendarDays}
          label="시즌 종료일"
          value={viewModel.seasonEndDate || '확인 필요'}
          helper="매칭 대화 유지 기준"
          tone="cyan"
        />
        <PostMatchMatchedMetric
          icon={MessageCircle}
          label="채팅"
          value={viewModel.capabilities.canStartChat ? '가능' : '닫힘'}
          helper={viewModel.capabilities.canStartChat ? '시즌 종료 전까지' : '정책에 따라 제한'}
          tone={viewModel.capabilities.canStartChat ? 'blue' : 'slate'}
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
        >
          <UserRound className="size-4" aria-hidden="true" />
          상대 프로필 보기
        </button>
        <button
          type="button"
          onClick={() => onNavigate('chat')}
          className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm font-bold text-cyan-700 transition-colors hover:bg-cyan-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          채팅 바로가기
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      {isProfileOpen && activeMatch && (
        <PostMatchCounterpartProfileModal
          activeMatch={activeMatch}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
}

function PostMatchCounterpartProfileModal({
  activeMatch,
  onClose,
}: {
  activeMatch: NonNullable<HomeDashboardViewModel['matchingSummary']['activeMatch']>;
  onClose: () => void;
}) {
  const summary = activeMatch.counterpartSummary?.profileSummary;
  const intro = summary?.intro.trim() || '아직 소개 문구가 없어요.';

  return (
    <HomeResponsiveSheet
      eyebrow="매칭 상대 프로필"
      title={`${activeMatch.nickname}님`}
      description="현재 확정된 매칭 상대의 시즌 프로필을 확인해요."
      icon={UserRound}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 flex-1 rounded-xl bg-(--knu-primary) px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-(--knu-primary-dark)"
        >
          확인했어요
        </button>
      }
    >
      <div className="space-y-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
          <p className="text-xs font-bold text-emerald-700">소개</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{intro}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <DetailRow label="닉네임" value={activeMatch.nickname} />
          <DetailRow label="매칭도" value={`${activeMatch.matchScore}%`} />
          <DetailRow label="흡연" value={formatProfileValue(summary?.smokingBehavior)} />
          <DetailRow label="수면" value={formatProfileValue(summary?.sleepHabit)} />
        </div>
      </div>
    </HomeResponsiveSheet>
  );
}

function PostMatchMatchedMetric({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  helper: string;
  tone: 'emerald' | 'cyan' | 'blue' | 'slate';
}) {
  const toneClassName = {
    emerald: 'border-emerald-100 bg-emerald-50/75 text-emerald-700',
    cyan: 'border-cyan-100 bg-cyan-50/75 text-cyan-700',
    blue: 'border-blue-100 bg-blue-50/75 text-blue-700',
    slate: 'border-slate-200 bg-white/80 text-slate-700',
  }[tone];

  return (
    <div className={`rounded-2xl border p-3 ${toneClassName}`}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="text-xs font-bold">{label}</span>
      </div>
      <p className="mt-2 text-lg font-extrabold">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium opacity-80">{helper}</p>
    </div>
  );
}

function PostMatchActivityButton({
  icon: Icon,
  label,
  onClick,
  variant,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  variant: 'primary' | 'secondary';
}) {
  const className =
    variant === 'primary'
      ? 'border-(--knu-border) bg-(--knu-background-alt) text-(--knu-text-primary) hover:bg-gray-100'
      : 'border-(--knu-border) bg-white text-(--knu-text-primary) hover:bg-(--knu-background-alt)';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </motion.button>
  );
}

function PostMatchDetailModal({
  kind,
  viewModel,
  onClose,
}: {
  kind: PostMatchDetailModalKind | null;
  viewModel: HomeDashboardViewModel;
  onClose: () => void;
}) {
  if (!kind) return null;

  const title = kind === 'activity' ? '이번 시즌 상세 보기' : '이번 시즌 프로필 확인';
  const description =
    kind === 'activity'
      ? '이번 시즌의 내 요청, 대화, 매칭 결과를 요약해서 보여드려요.'
      : '이번 시즌 참여 상태와 현재 계정 기준 프로필 정보를 함께 확인해요.';

  return (
    <HomeResponsiveSheet
      eyebrow="이번 시즌"
      title={title}
      description={description}
      icon={kind === 'activity' ? BarChart3 : UserRound}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 flex-1 rounded-xl bg-(--knu-primary) px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-(--knu-primary-dark)"
        >
          확인
        </button>
      }
    >
      {kind === 'activity' ? (
        <OffSeasonActivityDetail lastSeason={viewModel.seasonSummary.lastSeason} />
      ) : (
        <PostMatchProfileDetail viewModel={viewModel} />
      )}
    </HomeResponsiveSheet>
  );
}

function PostMatchProfileDetail({ viewModel }: { viewModel: HomeDashboardViewModel }) {
  return (
    <div className="space-y-3">
      <DetailRow label="참여 시즌" value={viewModel.currentSeasonName} />
      <DetailRow label="닉네임" value={viewModel.viewerIdentity.nickname} />
      <DetailRow label="성별" value={viewModel.viewerIdentity.genderLabel} />
      <DetailRow label="캠퍼스" value={viewModel.viewerIdentity.campusName} />
      <DetailRow label="기숙사" value={viewModel.dormitory?.name ?? '미선택'} />
      <div className="rounded-xl border border-(--knu-border) bg-(--knu-background-alt) px-4 py-3 text-xs leading-relaxed text-(--knu-text-secondary)">
        이번 시즌 생활패턴 상세는 별도 이력 화면으로 확장될 예정이에요. 지금은 홈에서 확인 가능한
        참여 상태와 계정 기준 정보를 먼저 보여드려요.
      </div>
    </div>
  );
}

type OffSeasonDetailModalKind = 'activity' | 'profile';

function OffSeasonActivityCard({
  viewModel,
  content,
}: {
  viewModel: HomeDashboardViewModel;
  content: ReturnType<typeof resolveOffSeasonActivityContent>;
}) {
  const [detailModal, setDetailModal] = useState<OffSeasonDetailModalKind | null>(null);
  const lastSeason = viewModel.seasonSummary.lastSeason;
  const Icon = content.icon;
  const canShowDetailActions = Boolean(lastSeason?.viewerHadRegistration);

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
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed whitespace-pre-line text-(--knu-text-secondary) sm:whitespace-normal">
          {content.body}
        </div>
      )}

      {canShowDetailActions && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <motion.button
            type="button"
            onClick={() => setDetailModal('activity')}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-(--knu-border) bg-(--knu-background-alt) px-4 py-2.5 text-sm font-bold text-(--knu-text-primary) transition-colors hover:bg-gray-100"
          >
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            <span>이전 시즌 상세 보기</span>
          </motion.button>
          {viewModel.capabilities.canViewMatchHistory && (
            <motion.button
              type="button"
              onClick={() => setDetailModal('profile')}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-(--knu-border) bg-white px-4 py-2.5 text-sm font-bold text-(--knu-text-primary) transition-colors hover:bg-(--knu-background-alt)"
            >
              <UserRound className="h-4 w-4" aria-hidden="true" />
              <span>이전 시즌 프로필 확인</span>
            </motion.button>
          )}
        </div>
      )}

      <OffSeasonDetailModal
        kind={detailModal}
        viewModel={viewModel}
        onClose={() => setDetailModal(null)}
      />
    </section>
  );
}

function OffSeasonDetailModal({
  kind,
  viewModel,
  onClose,
}: {
  kind: OffSeasonDetailModalKind | null;
  viewModel: HomeDashboardViewModel;
  onClose: () => void;
}) {
  if (!kind) return null;

  const lastSeason = viewModel.seasonSummary.lastSeason;
  const title = kind === 'activity' ? '이전 시즌 상세 보기' : '이전 시즌 프로필 확인';
  const description =
    kind === 'activity'
      ? '직전 시즌의 내 요청, 대화, 매칭 결과를 요약해서 보여드려요.'
      : '직전 시즌 참여 상태와 현재 계정 기준 프로필 정보를 함께 확인해요.';

  return (
    <HomeResponsiveSheet
      eyebrow="직전 시즌"
      title={title}
      description={description}
      icon={kind === 'activity' ? BarChart3 : UserRound}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 flex-1 rounded-xl bg-(--knu-primary) px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-(--knu-primary-dark)"
        >
          확인
        </button>
      }
    >
      {kind === 'activity' ? (
        <OffSeasonActivityDetail lastSeason={lastSeason} />
      ) : (
        <OffSeasonProfileDetail viewModel={viewModel} lastSeason={lastSeason} />
      )}
    </HomeResponsiveSheet>
  );
}

function OffSeasonActivityDetail({
  lastSeason,
}: {
  lastSeason: HomeDashboardViewModel['seasonSummary']['lastSeason'];
}) {
  if (!lastSeason) {
    return <EmptyDetailCard message="아직 확인할 수 있는 이전 시즌 활동이 없어요." />;
  }

  const activity = lastSeason.viewerActivity;

  return (
    <div className="space-y-3">
      <DetailRow label="시즌" value={lastSeason.name} />
      <DetailRow label="내 결과" value={resolveViewerActivityTitle(activity.finalResult)} />
      <div className="grid grid-cols-3 gap-2">
        <DetailMetric label="보낸 요청" value={activity.sentRequestCount} />
        <DetailMetric label="받은 요청" value={activity.receivedRequestCount} />
        <DetailMetric label="대화" value={activity.conversationCount} />
      </div>
      {activity.matchedPartnerNickname && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span className="font-extrabold text-green-700">{activity.matchedPartnerNickname}</span>
          님과 매칭이 성사되었어요.
        </div>
      )}
      <p className="text-xs leading-relaxed text-(--knu-text-tertiary)">
        전체 참여 {lastSeason.totalParticipants}명 · 매칭 완료 {lastSeason.totalMatchSuccess}쌍 ·
        운영 건물 {lastSeason.aggregate.operatedDormitoryCount}개
      </p>
    </div>
  );
}

function OffSeasonProfileDetail({
  viewModel,
  lastSeason,
}: {
  viewModel: HomeDashboardViewModel;
  lastSeason: HomeDashboardViewModel['seasonSummary']['lastSeason'];
}) {
  if (!lastSeason) {
    return <EmptyDetailCard message="이전 시즌 프로필로 연결할 시즌 참여 기록이 없어요." />;
  }

  return (
    <div className="space-y-3">
      <DetailRow label="참여 시즌" value={lastSeason.name} />
      <DetailRow label="닉네임" value={viewModel.viewerIdentity.nickname} />
      <DetailRow label="성별" value={viewModel.viewerIdentity.genderLabel} />
      <DetailRow label="캠퍼스" value={viewModel.viewerIdentity.campusName} />
      <div className="rounded-xl border border-(--knu-border) bg-(--knu-background-alt) px-4 py-3 text-xs leading-relaxed text-(--knu-text-secondary)">
        이전 시즌 생활패턴 상세는 별도 이력 화면으로 확장될 예정이에요. 지금은 홈에서 확인 가능한
        직전 시즌 참여 상태와 계정 기준 정보를 먼저 보여드려요.
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-(--knu-border) px-4 py-3">
      <span className="text-sm font-semibold text-(--knu-text-secondary)">{label}</span>
      <span className="text-sm font-bold text-(--knu-text-primary)">{value}</span>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-(--knu-background-alt) p-3 text-center">
      <p className="text-lg font-extrabold text-(--knu-primary)">{value}</p>
      <p className="text-xs text-(--knu-text-tertiary)">{label}</p>
    </div>
  );
}

function EmptyDetailCard({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-5 text-center text-sm text-(--knu-text-secondary)">
      {message}
    </div>
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
  value: number | string;
  tone: 'purple' | 'blue' | 'green' | 'gray';
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
    gray: {
      icon: 'bg-slate-100 text-slate-600',
      value: 'text-slate-700',
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

function StaticActivityButton({
  action,
  variant,
  tone,
}: {
  action: StaticActivityAction;
  variant: 'primary' | 'secondary';
  tone: StaticActivityTone;
}) {
  const ActionIcon = action.icon ?? BarChart3;
  const resolvedVariant = action.emphasis ?? variant;
  const className = getStaticActivityButtonClassName(resolvedVariant, action.buttonTone ?? tone);

  return (
    <motion.button
      type="button"
      onClick={action.onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${className}`}
    >
      <ActionIcon className="size-4" aria-hidden="true" />
      <span>{action.label}</span>
      {action.trailingIcon && <ChevronRight className="size-4" aria-hidden="true" />}
    </motion.button>
  );
}

function getStaticActivityButtonClassName(
  variant: 'primary' | 'secondary',
  tone: StaticActivityTone,
): string {
  if (variant === 'secondary') {
    if (tone === 'openRegistered') {
      return 'border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100/80';
    }
    if (tone === 'openReady' || tone === 'openRequired') {
      return 'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100';
    }
    return 'border-(--knu-border) bg-white text-(--knu-text-primary) hover:bg-(--knu-background-alt)';
  }

  if (tone === 'openRegistered') {
    return 'border-cyan-500 bg-cyan-500 text-white hover:bg-cyan-600';
  }
  if (tone === 'openReady') {
    return 'border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-200';
  }
  if (tone === 'openRequired') {
    return 'border-sky-600 bg-sky-600 text-white hover:bg-sky-700';
  }
  return 'border-(--knu-border) bg-(--knu-background-alt) text-(--knu-text-primary) hover:bg-gray-100';
}

function StaticActivityCard({
  eyebrow,
  title,
  body,
  icon: Icon,
  tone = 'default',
  metrics,
  action,
  secondaryAction,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  icon: React.ElementType;
  tone?: StaticActivityTone;
  metrics?: StaticActivityMetric[];
  action?: StaticActivityAction;
  secondaryAction?: StaticActivityAction;
}) {
  const toneClassName = STATIC_ACTIVITY_TONE_CLASS_NAMES[tone];

  return (
    <section className={sectionCard(toneClassName.section)} aria-labelledby="home-activity-title">
      <div className={sectionHeader}>
        <div>
          <p className={`mb-1 text-xs font-bold ${toneClassName.eyebrow}`}>{eyebrow}</p>
          <h2 id="home-activity-title" className="font-bold text-(--knu-text-primary)">
            {title}
          </h2>
        </div>
        <span
          className={`flex size-10 items-center justify-center rounded-2xl ${toneClassName.iconBox}`}
          aria-hidden="true"
        >
          <Icon className="size-5" />
        </span>
      </div>
      {body && <p className="mb-4 text-sm leading-relaxed text-(--knu-text-secondary)">{body}</p>}
      {metrics && metrics.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {metrics.map((metric) => (
            <StaticActivityMetricCell key={metric.label} metric={metric} />
          ))}
        </div>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {action && <StaticActivityButton action={action} variant="primary" tone={tone} />}
          {secondaryAction && (
            <StaticActivityButton action={secondaryAction} variant="secondary" tone={tone} />
          )}
        </div>
      )}
    </section>
  );
}

const STATIC_ACTIVITY_TONE_CLASS_NAMES: Record<
  StaticActivityTone,
  { section: string; eyebrow: string; iconBox: string }
> = {
  default: {
    section: '',
    eyebrow: 'text-(--knu-primary)',
    iconBox: 'bg-blue-50 text-(--knu-primary)',
  },
  openRequired: {
    section: 'border-sky-100 bg-sky-50 shadow-sm',
    eyebrow: 'text-sky-700',
    iconBox: 'bg-white text-sky-600 ring-1 ring-sky-100',
  },
  openReady: {
    section: 'border-blue-100 bg-blue-50 shadow-sm',
    eyebrow: 'text-sky-800',
    iconBox: 'bg-white text-sky-700 ring-1 ring-blue-100',
  },
  openRegistered: {
    section: 'border-cyan-100 bg-cyan-50 shadow-sm',
    eyebrow: 'text-cyan-700',
    iconBox: 'bg-white text-cyan-700 ring-1 ring-cyan-100',
  },
  openWaiting: {
    section: 'border-slate-200 bg-slate-50 shadow-sm',
    eyebrow: 'text-slate-700',
    iconBox: 'bg-white text-slate-600 ring-1 ring-slate-200',
  },
  postMatch: {
    section: 'border-purple-100 bg-purple-50/70 shadow-sm',
    eyebrow: 'text-purple-700',
    iconBox: 'bg-white text-purple-700 ring-1 ring-purple-100',
  },
  postMatchMatched: {
    section: 'border-emerald-100 bg-emerald-50/80 shadow-sm',
    eyebrow: 'text-emerald-700',
    iconBox: 'bg-white text-emerald-700 ring-1 ring-emerald-100',
  },
};

const STATIC_ACTIVITY_METRIC_CLASS_NAMES: Record<
  NonNullable<StaticActivityMetric['tone']>,
  { cell: string; icon: string; value: string }
> = {
  neutral: {
    cell: 'backdrop-blur-md rounded-xl border border-slate-200 bg-slate-50/85 p-3 shadow-sm',
    icon: 'text-slate-500',
    value: 'text-slate-800',
  },
  participant: {
    cell: 'backdrop-blur-md rounded-xl border border-cyan-200 bg-cyan-50/90 p-3 shadow-sm',
    icon: 'text-cyan-600',
    value: 'text-cyan-900',
  },
  buildingOpen: {
    cell: 'backdrop-blur-md rounded-xl border border-blue-200/70 bg-blue-50/80 p-3 shadow-sm',
    icon: 'text-blue-600',
    value: 'text-blue-900',
  },
  buildingLocked: {
    cell: 'backdrop-blur-md rounded-xl border border-blue-200/70 bg-blue-50/80 p-3 shadow-sm',
    icon: 'text-blue-600',
    value: 'text-blue-900',
  },
  matchSuccess: {
    cell: 'backdrop-blur-md rounded-xl border border-emerald-200 bg-emerald-50/85 p-3 shadow-sm',
    icon: 'text-emerald-600',
    value: 'text-emerald-900',
  },
  result: {
    cell: 'backdrop-blur-md rounded-xl border border-purple-200 bg-purple-50/80 p-3 shadow-sm',
    icon: 'text-purple-600',
    value: 'text-purple-900',
  },
};

function StaticActivityMetricCell({ metric }: { metric: StaticActivityMetric }) {
  const MetricIcon = metric.icon;
  const toneClassName = STATIC_ACTIVITY_METRIC_CLASS_NAMES[metric.tone ?? 'neutral'];
  const content = (
    <>
      <div className="mb-1 flex items-center gap-1.5">
        <MetricIcon className={`size-3.5 ${toneClassName.icon}`} aria-hidden="true" />
        <p className="text-[11px] font-bold text-(--knu-text-tertiary)">{metric.label}</p>
        {metric.onClick && (
          <ChevronRight className="ml-auto size-3 text-(--knu-text-tertiary)" aria-hidden="true" />
        )}
      </div>
      <p className={`flex items-baseline gap-1 text-sm font-extrabold ${toneClassName.value}`}>
        <span>{metric.value}</span>
        {metric.todayNewCount !== undefined && metric.todayNewCount > 0 && (
          <motion.span
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-xs font-bold text-green-600"
          >
            (+{metric.todayNewCount}명)
          </motion.span>
        )}
      </p>
      <p className="mt-0.5 text-[11px] text-(--knu-text-tertiary)">{metric.helper}</p>
    </>
  );

  const className = toneClassName.cell;

  if (metric.onClick) {
    return (
      <button
        type="button"
        onClick={metric.onClick}
        className={`${className} text-left transition-transform hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)`}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function formatProfileValue(value: string | null | undefined): string {
  if (!value) return '미입력';
  const labels: Record<string, string> = {
    NO: '비흡연',
    YES: '흡연',
    NONE: '해당 없음',
    CLOSE: '가까운 교류',
    RESPECTFUL: '적당한 거리',
    QUIET: '조용한 편',
    LATE: '늦은 편',
    EARLY: '이른 편',
  };
  return labels[value] ?? value.replaceAll('_', ' ').toLowerCase();
}
