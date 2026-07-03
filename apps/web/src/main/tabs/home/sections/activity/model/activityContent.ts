import {
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  History,
  Inbox,
  ListChecks,
  MessageCircle,
  Search,
  Send,
  UserRound,
  XCircle,
} from 'lucide-react';
import type { TabId, MatchingNavOptions } from '@/types/profile';
import type { HomeDashboardViewModel } from '../../../model/homeDashboardViewModel';
import type {
  PostMatchActivityOutcome,
  SeasonOpenModalKind,
  StaticActivityAction,
  StaticActivityMetric,
  StaticActivityTone,
} from './activityTypes';

export function resolvePostMatchActivityContent({
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

export function resolvePostMatchActivityOutcome(
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

export function buildPostMatchActivityMetrics({
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

export function resolveSeasonOpenActivityContent({
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

export function buildSeasonOpenExplorationMetrics({
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

export function formatPersonCount(count: number): string {
  return `${Math.max(0, count)}명`;
}

export function resolveOffSeasonActivityContent(viewModel: HomeDashboardViewModel): {
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

export function resolveViewerActivityTitle(
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
