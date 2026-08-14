import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  History,
  Info,
  MessageCircle,
  Search,
  ShieldAlert,
  UserRound,
  UserRoundCheck,
  Users,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { HomeDashboardViewModel } from '../../../model/homeDashboardViewModel';
import type {
  PrimaryAction,
  PrimaryContent,
  PrimaryDateRow,
  PrimaryDeadlineTone,
  PrimaryInsight,
  PrimaryPolicyHint,
  PrimarySuccessHighlight,
  PrimaryTaskStep,
  ResolvePrimaryContentParams,
  SeasonOpenPolicyHintContext,
} from './primaryTypes';

const NO_NEXT_SEASON_EYEBROW_WITH_HISTORY = '시즌 매칭 종료';
const NO_NEXT_SEASON_EYEBROW_WITHOUT_HISTORY = '시즌 일정 공개 전';
const NO_NEXT_SEASON_TITLE = '다음 시즌에 만나요.';
const NO_NEXT_SEASON_BODY = '다음 시즌 일정은 학교 공식 일정에 맞춰 등록될 예정이에요.';

export function resolvePrimaryContent({
  viewModel,
  seasonState,
  daysUntilEnd,
  onNavigate,
  onOpenBuildingSelect,
  onOpenWithdrawalSheet,
}: ResolvePrimaryContentParams): PrimaryContent {
  const goProfile = () => onNavigate('profile');
  const goList = () => onNavigate('list');
  const openBuildingSelect = () => onOpenBuildingSelect?.();

  if (!viewModel.isCampusOperated) {
    return {
      eyebrow: '운영 준비',
      title: '서비스 운영 준비 중이에요',
      body: `${viewModel.campusName} 캠퍼스는 현재 서비스 운영 준비 중이에요. 계정 정보는 확인할 수 있고, 운영이 열리면 홈에서 시즌 안내를 보여드릴게요.`,
      icon: ShieldAlert,
      tone: 'slate',
      action: { label: '내 정보 확인', icon: UserRound, onClick: goProfile },
      insights: [
        {
          label: '캠퍼스',
          value: viewModel.campusName,
          icon: Building2,
          iconClassName: 'bg-blue-50 text-blue-600',
        },
        {
          label: '상태',
          value: '준비 중',
          icon: Clock3,
          iconClassName: 'bg-slate-100 text-slate-600',
        },
        {
          label: '가능',
          value: '내 정보',
          icon: UserRound,
          iconClassName: 'bg-cyan-50 text-cyan-600',
        },
      ],
    };
  }

  if (!viewModel.hasCurrentSeason) {
    const hasNextSeasonPreview = viewModel.seasonSummary.hasNextSeasonPreview;
    const nextSeasonName = viewModel.seasonSummary.nextSeasonName;
    const noNextSeasonEyebrow = viewModel.seasonSummary.lastSeason
      ? `${viewModel.seasonSummary.pastSeasonName} ${NO_NEXT_SEASON_EYEBROW_WITH_HISTORY}`
      : NO_NEXT_SEASON_EYEBROW_WITHOUT_HISTORY;

    return {
      eyebrow: hasNextSeasonPreview ? '다음 시즌 예고' : noNextSeasonEyebrow,
      title: hasNextSeasonPreview ? `${nextSeasonName} 준비가 곧 시작돼요` : NO_NEXT_SEASON_TITLE,
      body: hasNextSeasonPreview ? undefined : NO_NEXT_SEASON_BODY,
      icon: CalendarDays,
      tone: 'slate',
      insights: buildOffSeasonInsights(viewModel),
      insightTitle: buildOffSeasonInsights(viewModel).length > 0 ? '이전 시즌 요약' : undefined,
      insightSubtitle: buildOffSeasonInsightSubtitle(viewModel),
      dateRows: hasNextSeasonPreview ? buildOffSeasonDateRows(viewModel) : undefined,
      policyHints: buildOffSeasonPolicyHints(viewModel),
      policyHintAriaLabel: '비시즌 안내',
    };
  }

  if (seasonState === 'SEASON_OPEN') {
    return resolveSeasonOpenPrimaryContent({
      viewModel,
      goProfile,
      goList,
      openBuildingSelect,
      phaseLabel: '시즌 오픈',
    });
  }

  if (seasonState === 'SEASON_MATCHING') {
    if (!viewModel.preparation.registrationReady) {
      return resolveSeasonOpenPrimaryContent({
        viewModel,
        goProfile,
        goList,
        openBuildingSelect,
        phaseLabel: '시즌 매칭',
      });
    }

    return resolveSeasonMatchingRegisteredPrimaryContent({
      viewModel,
      daysUntilEnd,
      goList,
      onOpenWithdrawalSheet,
    });
  }

  if (seasonState === 'SEASON_POST_MATCH') {
    return resolvePostMatchPrimaryContent({
      viewModel,
      daysUntilEnd,
    });
  }

  return {
    eyebrow: viewModel.seasonSummary.hasNextSeasonPreview
      ? '다음 시즌 예고'
      : viewModel.seasonSummary.lastSeason
        ? `${viewModel.seasonSummary.pastSeasonName} ${NO_NEXT_SEASON_EYEBROW_WITH_HISTORY}`
        : NO_NEXT_SEASON_EYEBROW_WITHOUT_HISTORY,
    title: viewModel.seasonSummary.hasNextSeasonPreview
      ? `${viewModel.seasonSummary.nextSeasonName} 준비를 기다려요`
      : NO_NEXT_SEASON_TITLE,
    body: viewModel.seasonSummary.daysUntilNext > 0 ? undefined : NO_NEXT_SEASON_BODY,
    icon: Clock3,
    tone: 'slate',
    insights: buildOffSeasonInsights(viewModel),
    insightTitle: buildOffSeasonInsights(viewModel).length > 0 ? '이전 시즌 요약' : undefined,
    insightSubtitle: buildOffSeasonInsightSubtitle(viewModel),
    dateRows: viewModel.seasonSummary.hasNextSeasonPreview
      ? buildOffSeasonDateRows(viewModel)
      : undefined,
    policyHints: buildOffSeasonPolicyHints(viewModel),
    policyHintAriaLabel: '비시즌 안내',
  };
}

type PostMatchPrimaryOutcome =
  | 'not-registered'
  | 'deregistered'
  | 'matched'
  | 'unmatched-after-success'
  | 'not-matched'
  | 'history';

function resolvePostMatchPrimaryContent({
  viewModel,
  daysUntilEnd,
}: {
  viewModel: HomeDashboardViewModel;
  daysUntilEnd: number;
}): PrimaryContent {
  const outcome = resolvePostMatchPrimaryOutcome(viewModel);
  const baseContent = {
    icon: History,
    dateRows: buildPostMatchDateRows(viewModel, daysUntilEnd),
    insights: buildPostMatchInsights(viewModel, outcome),
    insightTitle: '이번 시즌 요약',
    insightSubtitle: `${viewModel.campusName} · 남/여 전체 기준`,
    policyHints: buildPostMatchPolicyHints(viewModel),
    policyHintAriaLabel: '마감 정리 기간 안내',
  } satisfies Partial<PrimaryContent>;

  if (outcome === 'matched') {
    return {
      ...baseContent,
      eyebrow: '시즌 마감 정리 · 매칭 종료',
      title: `${viewModel.currentSeasonName} 매칭이 종료됐어요.`,
      icon: UserRoundCheck,
      tone: 'purple',
    };
  }

  if (outcome === 'deregistered') {
    return {
      ...baseContent,
      eyebrow: '시즌 마감 정리 · 매칭 종료',
      title: `${viewModel.currentSeasonName} 매칭이 종료됐어요.`,
      icon: XCircle,
      tone: 'purple',
    };
  }

  if (outcome === 'not-registered') {
    return {
      ...baseContent,
      eyebrow: '시즌 마감 정리 · 매칭 종료',
      title: `${viewModel.currentSeasonName} 매칭이 종료됐어요.`,
      icon: Clock3,
      tone: 'purple',
    };
  }

  if (outcome === 'unmatched-after-success') {
    return {
      ...baseContent,
      eyebrow: '시즌 마감 정리 · 매칭 종료',
      title: `${viewModel.currentSeasonName} 매칭이 종료됐어요.`,
      icon: History,
      tone: 'purple',
    };
  }

  if (outcome === 'not-matched') {
    return {
      ...baseContent,
      eyebrow: '시즌 마감 정리 · 매칭 종료',
      title: `${viewModel.currentSeasonName} 매칭이 종료됐어요.`,
      icon: History,
      tone: 'purple',
    };
  }

  return {
    ...baseContent,
    eyebrow: '시즌 마감 정리 · 매칭 종료',
    title: `${viewModel.currentSeasonName} 매칭이 종료됐어요.`,
    icon: History,
    tone: 'purple',
  };
}

function resolvePostMatchPrimaryOutcome(
  viewModel: HomeDashboardViewModel,
): PostMatchPrimaryOutcome {
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

function resolveSeasonMatchingRegisteredPrimaryContent({
  viewModel,
  daysUntilEnd,
  goList,
  onOpenWithdrawalSheet,
}: {
  viewModel: HomeDashboardViewModel;
  daysUntilEnd: number;
  goList: () => void;
  onOpenWithdrawalSheet?: () => void;
}): PrimaryContent {
  const matchingWindow = viewModel.matchingWindow;
  const progressTone = resolveMatchingProgressTone(matchingWindow?.progressPercent);
  const progress = matchingWindow
    ? {
        label: '시즌 진행률',
        value: `${matchingWindow.progressPercent}%`,
        percent: matchingWindow.progressPercent,
        tone: progressTone,
      }
    : undefined;
  const dateRows = buildSeasonMatchingDateRows(viewModel);
  const insights = buildSeasonMatchingMetrics(viewModel);
  const successHighlight = buildSeasonMatchingSuccessHighlight(viewModel, daysUntilEnd);
  const policyHints = viewModel.hasActiveMatch
    ? buildSeasonMatchingActiveMatchPolicyHints()
    : buildSeasonMatchingRegisteredPolicyHints();
  const base = {
    eyebrow: '시즌 매칭 · 매칭 현황',
    progress,
    dateRows,
    insights,
    insightTitle: '이번 시즌 현황',
    successHighlight,
    policyHints,
    policyHintAriaLabel: '시즌 매칭 안내',
    title: viewModel.hasActiveMatch
      ? '호실 선택은 학교 서비스를 이용해요.'
      : '나와 잘 맞는 룸메이트를 찾아보세요.',
    icon: CalendarDays,
    tone: 'blue',
  } satisfies Partial<PrimaryContent>;

  if (viewModel.hasActiveMatch) {
    return {
      ...base,
      title: '확정된 룸메이트와 남은 일정을 확인해요.',
    };
  }

  const withdrawalAction: PrimaryAction | undefined = onOpenWithdrawalSheet
    ? {
        label: '시즌 참여 철회하기',
        icon: XCircle,
        onClick: onOpenWithdrawalSheet,
        variant: 'warning',
      }
    : undefined;

  if (viewModel.matchingSummary.stats.receivedRequests > 0) {
    return {
      ...base,
      action: { label: '룸메이트 찾기', icon: Search, onClick: goList },
      secondaryAction: withdrawalAction,
    };
  }

  if (viewModel.matchingSummary.stats.sentRequests > 0) {
    return {
      ...base,
      action: { label: '룸메이트 찾기', icon: Search, onClick: goList },
      secondaryAction: withdrawalAction,
    };
  }

  return {
    ...base,
    action: { label: '룸메이트 찾기', icon: Search, onClick: goList },
    secondaryAction: withdrawalAction,
  };
}

function resolveSeasonOpenPrimaryContent({
  viewModel,
  goProfile,
  goList,
  openBuildingSelect,
  phaseLabel,
}: {
  viewModel: HomeDashboardViewModel;
  goProfile: () => void;
  goList: () => void;
  openBuildingSelect: () => void;
  phaseLabel: '시즌 오픈' | '시즌 매칭';
}): PrimaryContent {
  const reasons = viewModel.preparation.registrationUnavailableReasons;
  const hasReason = (
    reason: HomeDashboardViewModel['preparation']['registrationUnavailableReasons'][number],
  ) => reasons.includes(reason);
  const needsSeasonProfile = !viewModel.preparation.hasSeasonProfile;
  const needsBuilding = !viewModel.preparation.hasBuilding;
  const isRegistered = viewModel.preparation.registrationReady;
  const steps = buildSeasonOpenTaskSteps(viewModel);
  const dateRows = buildSeasonOpenDateRows(viewModel, phaseLabel);

  if (hasReason('NO_SELECTABLE_DORMITORY')) {
    return {
      eyebrow: `${phaseLabel} · 운영 준비`,
      title: '운영 기숙사 정보가 준비 중이에요',
      icon: Building2,
      tone: 'amber',
      action: needsSeasonProfile
        ? { label: '시즌 프로필 설정', icon: ClipboardList, onClick: goProfile }
        : undefined,
      steps,
      dateRows,
      notice: {
        tone: 'warning',
        text: needsSeasonProfile
          ? '운영 정보가 등록되기 전에도 시즌 프로필은 먼저 준비할 수 있어요.'
          : '운영 정보가 등록되면 기숙사 선택을 안내할게요.',
      },
    };
  }

  if (needsSeasonProfile && needsBuilding) {
    return {
      eyebrow: `${phaseLabel} · 준비 시작`,
      title: '시즌 참여를 준비해요',
      icon: ClipboardList,
      tone: 'openRequired',
      action: { label: '생활패턴·룸메 조건 설정', icon: UserRound, onClick: goProfile },
      secondaryAction: viewModel.preparation.canSelectBuilding
        ? {
            label: '배정된 기숙사 설정',
            icon: Building2,
            onClick: openBuildingSelect,
            variant: 'secondary',
          }
        : undefined,
      steps,
      dateRows,
      policyHints: buildSeasonOpenPolicyHints(
        viewModel,
        'profile-and-dormitory-required',
        phaseLabel,
      ),
      policyHintAriaLabel: `${phaseLabel} 안내`,
    };
  }

  if (
    viewModel.preparation.hasSeasonProfile &&
    needsBuilding &&
    viewModel.preparation.canSelectBuilding
  ) {
    return {
      eyebrow: `${phaseLabel} · 기숙사 선택`,
      title: '시즌 참여를 준비해요',
      icon: ClipboardList,
      tone: 'openRequired',
      action: { label: '생활패턴·룸메 조건 설정', icon: UserRound, onClick: goProfile },
      secondaryAction: {
        label: '배정된 기숙사 설정',
        icon: Building2,
        onClick: openBuildingSelect,
        variant: 'secondary',
      },
      steps,
      dateRows,
      policyHints: buildSeasonOpenPolicyHints(viewModel, 'dormitory-required', phaseLabel),
      policyHintAriaLabel: `${phaseLabel} 안내`,
    };
  }

  if (needsSeasonProfile && viewModel.preparation.hasBuilding) {
    return {
      eyebrow: `${phaseLabel} · 시즌 프로필`,
      title: '시즌 참여를 준비해요',
      icon: ClipboardList,
      tone: 'openRequired',
      action: { label: '생활패턴·룸메 조건 설정', icon: UserRound, onClick: goProfile },
      secondaryAction: {
        label: '배정된 기숙사 설정',
        icon: Building2,
        onClick: openBuildingSelect,
        variant: 'secondary',
      },
      steps,
      dateRows,
      policyHints: buildSeasonOpenPolicyHints(viewModel, 'profile-required', phaseLabel),
      policyHintAriaLabel: `${phaseLabel} 안내`,
    };
  }

  if (!isRegistered && reasons.length === 0) {
    return {
      eyebrow: `${phaseLabel} · 준비 완료`,
      title: '시즌 참여 신청만 남았어요',
      icon: ClipboardCheck,
      tone: 'openPrep',
      action: { label: '시즌 참여 신청하기', icon: ClipboardCheck, onClick: goProfile },
      secondaryAction: {
        label: '입력 내용 확인',
        icon: UserRound,
        onClick: goProfile,
        variant: 'secondary',
      },
      steps,
      dateRows,
      policyHints: buildSeasonOpenPolicyHints(viewModel, 'registration-ready', phaseLabel),
      policyHintAriaLabel: `${phaseLabel} 안내`,
    };
  }

  if (
    isRegistered &&
    viewModel.capabilities.canEnterRoommateSearch &&
    !viewModel.capabilities.canRequestMatch
  ) {
    return {
      eyebrow: `${phaseLabel} · 참여 완료`,
      title: '룸메 후보를 미리 알아보세요',
      icon: Search,
      tone: 'cyan',
      action: { label: '룸메 후보 보기', icon: Search, onClick: goList },
      secondaryAction: {
        label: '시즌 프로필 확인',
        icon: UserRound,
        onClick: goProfile,
        variant: 'secondary',
      },
      steps,
      dateRows,
      policyHints: buildSeasonOpenPolicyHints(viewModel, 'registered-summary', phaseLabel),
      policyHintAriaLabel: `${phaseLabel} 안내`,
    };
  }

  if (isRegistered) {
    return {
      eyebrow: `${phaseLabel} · 참여 완료`,
      title: '매칭 시작을 기다리고 있어요',
      icon: CheckCircle2,
      tone: 'cyan',
      action: { label: '시즌 프로필 확인', icon: UserRound, onClick: goProfile },
      steps,
      dateRows,
      policyHints: buildSeasonOpenPolicyHints(viewModel, 'registered-summary', phaseLabel),
      policyHintAriaLabel: `${phaseLabel} 안내`,
    };
  }

  return buildSeasonOpenBlockedContent({
    viewModel,
    goProfile,
    openBuildingSelect,
    steps,
    dateRows,
    phaseLabel,
  });
}

function buildSeasonOpenTaskSteps(viewModel: HomeDashboardViewModel): PrimaryTaskStep[] {
  const reasons = viewModel.preparation.registrationUnavailableReasons;
  const noSelectableDormitory = reasons.includes('NO_SELECTABLE_DORMITORY');
  const profileReady = viewModel.preparation.hasSeasonProfile;
  const buildingReady = viewModel.preparation.hasBuilding;
  const registrationReady = viewModel.preparation.registrationReady;
  const participationLocked = reasons.includes('WITHDRAWN_OR_DECLINED_LOCK');
  const registrationActionable =
    profileReady && buildingReady && !registrationReady && reasons.length === 0;

  return [
    {
      id: 'profile',
      label: '시즌 프로필',
      status: profileReady ? 'complete' : 'actionable',
      statusLabel: profileReady ? '완료' : '필요',
      helper: '생활패턴·룸메 조건 설정',
    },
    {
      id: 'dormitory',
      label: '기숙사',
      status: buildingReady
        ? 'complete'
        : noSelectableDormitory
          ? 'blocked'
          : viewModel.preparation.canSelectBuilding
            ? 'actionable'
            : 'locked',
      statusLabel: buildingReady ? '완료' : noSelectableDormitory ? '보류' : '필요',
      helper: noSelectableDormitory ? '운영 정보 대기' : '배정된 기숙사 설정',
    },
    {
      id: 'registration',
      label: '시즌 참여 신청',
      status: registrationReady
        ? 'complete'
        : participationLocked
          ? 'blocked'
          : registrationActionable
            ? 'actionable'
            : 'locked',
      statusLabel: registrationReady
        ? '완료'
        : participationLocked
          ? '불가'
          : registrationActionable
            ? '가능'
            : '대기',
      helper: registrationReady
        ? '룸메 후보 보기 가능'
        : participationLocked
          ? '문의하기에서 확인'
          : registrationActionable
            ? '지금 신청 가능'
            : '조건 완료 후 가능',
    },
  ];
}

function buildSeasonOpenPolicyHints(
  viewModel: HomeDashboardViewModel,
  context: SeasonOpenPolicyHintContext,
  phaseLabel: '시즌 오픈' | '시즌 매칭',
): PrimaryPolicyHint[] {
  const contextualHint = buildSeasonOpenContextualHint(context);
  const matchingActionHint: PrimaryPolicyHint =
    phaseLabel === '시즌 오픈'
      ? {
          label: '매칭 시스템',
          text: '매칭 신청과 수락은 시즌 매칭 기간에만 열려요.',
          icon: Clock3,
          iconClassName: 'text-amber-700',
        }
      : {
          label: '매칭 요청',
          text: '시즌 참여 후 같은 기숙사 참여자와 매칭 요청을 주고받을 수 있어요.',
          icon: Users,
          iconClassName: 'text-purple-600',
        };
  const commonHints: PrimaryPolicyHint[] = [
    {
      label: '룸메 후보 탐색',
      text: '시즌 참여 후 같은 기숙사 참여자를 확인할 수 있어요.',
      icon: Search,
      iconClassName: 'text-cyan-600',
    },
    {
      label: '대화 시작',
      text: '시즌 참여 후 같은 기숙사 참여자와 먼저 대화할 수 있어요.',
      icon: MessageCircle,
      iconClassName: 'text-blue-600',
    },
    matchingActionHint,
  ];

  if (context === 'registered-summary') {
    return [
      contextualHint,
      commonHints[1]!,
      {
        label: '내 프로필',
        text: '같은 기숙사 참여자에게 내 시즌 프로필이 표시돼요.',
        icon: UserRoundCheck,
        iconClassName: 'text-sky-700',
      },
      commonHints[2]!,
    ];
  }

  return [contextualHint, ...commonHints];
}

function buildSeasonOpenContextualHint(context: SeasonOpenPolicyHintContext): PrimaryPolicyHint {
  switch (context) {
    case 'profile-and-dormitory-required':
    case 'dormitory-required':
    case 'profile-required':
      return {
        label: '시즌 참여 준비',
        text: '시즌 프로필·배정된 기숙사를 설정하고 시즌 참여가 가능해요.',
        icon: ClipboardList,
        iconClassName: 'text-sky-600',
      };
    case 'registration-ready':
      return {
        label: '시즌 참여 신청',
        text: '입력한 시즌 프로필·배정된 기숙사 정보로 시즌 참여가 가능해요.',
        icon: ClipboardCheck,
        iconClassName: 'text-green-600',
      };
    case 'registered-summary':
      return {
        label: '룸메 후보',
        text: '같은 기숙사 참여자의 시즌 프로필과 기본 정보를 확인할 수 있어요.',
        icon: Search,
        iconClassName: 'text-cyan-600',
      };
  }
}

function buildSeasonOpenDateRows(
  viewModel: HomeDashboardViewModel,
  phaseLabel: '시즌 오픈' | '시즌 매칭',
): PrimaryDateRow[] | undefined {
  if (phaseLabel === '시즌 매칭') {
    const isParticipationLocked = viewModel.preparation.registrationUnavailableReasons.includes(
      'WITHDRAWN_OR_DECLINED_LOCK',
    );

    return [
      {
        label: '매칭 시즌',
        value: `${viewModel.preparation.seasonStartDate ?? '시즌 매칭'} ~`,
        strongValue: '진행 중',
        badge: isParticipationLocked ? '참여 불가' : '참여 가능',
        tone: isParticipationLocked ? 'closed' : 'normal',
        hideValueOnNarrow: true,
        hideBadgeOnNarrow: true,
      },
    ];
  }

  if (!viewModel.preparation.seasonStartDate) {
    return undefined;
  }

  return [
    {
      label: '매칭 시작',
      value: viewModel.preparation.seasonStartDate,
      badge:
        viewModel.preparation.daysUntilStart > 0
          ? `D-${viewModel.preparation.daysUntilStart}`
          : undefined,
    },
  ];
}

function buildSeasonOpenBlockedContent({
  viewModel,
  goProfile,
  openBuildingSelect,
  steps,
  dateRows,
  phaseLabel,
}: {
  viewModel: HomeDashboardViewModel;
  goProfile: () => void;
  openBuildingSelect: () => void;
  steps: PrimaryTaskStep[];
  dateRows: PrimaryDateRow[] | undefined;
  phaseLabel: '시즌 오픈' | '시즌 매칭';
}): PrimaryContent {
  const reasons = viewModel.preparation.registrationUnavailableReasons;
  const hasReason = (
    reason: HomeDashboardViewModel['preparation']['registrationUnavailableReasons'][number],
  ) => reasons.includes(reason);
  const canRetryDormitory = hasReason('DORMITORY_SELECTION_REQUIRED');

  if (hasReason('DORMITORY_SELECTION_CLOSED')) {
    return {
      eyebrow: `${phaseLabel} · 확인 필요`,
      title: '기숙사 선택 기간이 지났어요',
      body: '이번 시즌 기숙사 선택 가능 기간이 지나 시즌 참여 신청을 마칠 수 없어요.',
      icon: Clock3,
      tone: 'amber',
      action: { label: '입력 내용 확인', icon: UserRound, onClick: goProfile },
      steps,
      dateRows,
      notice: { tone: 'warning', text: '운영 안내가 필요하면 관리자 공지를 확인해주세요.' },
    };
  }

  if (hasReason('WITHDRAWN_OR_DECLINED_LOCK')) {
    return {
      eyebrow: `${phaseLabel} · 참여 제한`,
      title: '이번 시즌 참여가 제한됐어요',
      body: '시즌 참여 철회 후 재참여는 불가능해요',
      icon: ShieldAlert,
      tone: 'slate',
      steps,
      dateRows,
      notice: { tone: 'warning', text: '시즌 재참여가 필요한 경우에 문의하기를 이용해주세요.' },
    };
  }

  if (hasReason('UNSUPPORTED_CAMPUS')) {
    return {
      eyebrow: `${phaseLabel} · 확인 필요`,
      title: '현재 캠퍼스는 준비 중이에요',
      body: `${viewModel.campusName} 캠퍼스는 아직 이번 시즌 참여 신청을 지원하지 않아요.`,
      icon: Building2,
      tone: 'slate',
      steps,
      dateRows,
    };
  }

  return {
    eyebrow: `${phaseLabel} · 확인 필요`,
    title: '시즌 참여 신청 상태를 확인해요',
    body: '현재 상태에서는 바로 시즌 참여 신청을 마칠 수 없어요. 필요한 정보를 확인해주세요.',
    icon: Info,
    tone: 'amber',
    action: canRetryDormitory
      ? { label: '기숙사 선택', icon: Building2, onClick: openBuildingSelect }
      : { label: '신청 상태 확인', icon: UserRound, onClick: goProfile },
    steps,
    dateRows,
  };
}

function buildOffSeasonPolicyHints(viewModel: HomeDashboardViewModel): PrimaryPolicyHint[] {
  const scheduleText = viewModel.seasonSummary.hasNextSeasonPreview
    ? '다음 시즌 일정에 맞춰 시즌 참여 준비를 홈에서 안내해요.'
    : '시즌 일정이 준비되면 홈에서 안내할게요.';

  return [
    {
      label: '비시즌 이용 범위',
      text: '새 룸메 탐색·대화 시작·매칭 요청은 시즌 기간에만 열려요.',
      icon: Search,
      iconClassName: 'text-slate-600',
    },
    {
      label: '확인 가능한 정보',
      text: '내 정보와 이전 시즌 기록은 비시즌에도 계속 확인할 수 있어요.',
      icon: History,
      iconClassName: 'text-blue-600',
    },
    {
      label: '시즌 프로필',
      text: '새 시즌 프로필은 시즌이 열리면 새로 준비해요.',
      icon: UserRound,
      iconClassName: 'text-purple-600',
    },
    {
      label: '다음 안내',
      text: scheduleText,
      icon: CalendarDays,
      iconClassName: 'text-cyan-600',
    },
  ];
}

function buildOffSeasonInsights(viewModel: HomeDashboardViewModel): PrimaryInsight[] {
  const lastSeason = viewModel.seasonSummary.lastSeason;

  if (!lastSeason) {
    return [];
  }

  return [
    {
      label: '지난 참여',
      value: `${lastSeason.totalParticipants}명`,
      icon: UserRound,
      iconClassName: 'bg-blue-50 text-blue-600',
    },
    {
      label: '매칭 완료',
      value: `${lastSeason.aggregate.matchedPairCount}쌍`,
      icon: CheckCircle2,
      iconClassName: 'bg-green-50 text-green-600',
    },
  ];
}

function buildOffSeasonInsightSubtitle(viewModel: HomeDashboardViewModel): string | undefined {
  const lastSeason = viewModel.seasonSummary.lastSeason;

  if (!lastSeason) {
    return undefined;
  }

  return `${viewModel.campusName} · 남/여 전체 기준`;
}

function buildOffSeasonDateRows(viewModel: HomeDashboardViewModel): PrimaryDateRow[] {
  return [
    {
      label: '시즌 오픈',
      value: viewModel.seasonSummary.nextSeasonDate,
      badge: `D-${viewModel.seasonSummary.daysUntilNext}`,
    },
  ];
}

function resolveMatchingProgressTone(progressPercent?: number): PrimaryDeadlineTone {
  if (progressPercent !== undefined && progressPercent >= 90) return 'critical';
  if (progressPercent !== undefined && progressPercent >= 70) return 'warning';

  return 'normal';
}

function buildSeasonMatchingDateRows(
  viewModel: HomeDashboardViewModel,
): PrimaryDateRow[] | undefined {
  const matchingWindow = viewModel.matchingWindow;
  if (!matchingWindow) {
    return undefined;
  }

  return [
    {
      label: '매칭 시즌',
      value: `${matchingWindow.matchingStartDate} ~ ${matchingWindow.roomSelectionDate}`,
      tone: 'normal',
    },
    {
      label: '호실 선택일',
      value: matchingWindow.roomSelectionDate,
      pill: `${matchingWindow.roomSelectionDormitoryName} 기준`,
      tone: 'normal',
      hidePillOnNarrow: true,
      badge:
        matchingWindow.daysUntilRoomSelection > 0
          ? `D-${matchingWindow.daysUntilRoomSelection}`
          : '오늘',
    },
  ];
}

function buildSeasonMatchingMetrics(viewModel: HomeDashboardViewModel): PrimaryInsight[] {
  return [
    {
      label: '이번 시즌 참여자',
      value: `${viewModel.statsBar.totalCount}명`,
      helper: `${viewModel.campusName} 기준`,
      icon: UserRound,
      iconClassName: 'bg-cyan-50 text-cyan-600',
      tone: 'participant',
      todayNewCount: viewModel.statsBar.todayNewTotal,
    },
    {
      label: '내 건물 참여자',
      value: `${viewModel.statsBar.buildingCount}명`,
      helper: `${viewModel.dormitory?.name ?? '내 건물'} 기준`,
      icon: Building2,
      iconClassName: 'bg-blue-50 text-blue-600',
      tone: 'buildingOpen',
      todayNewCount: viewModel.statsBar.todayNewBuilding,
    },
    {
      label: '매칭 성공',
      value: `${viewModel.statsBar.matchSuccessCount}명`,
      helper: `${viewModel.campusName} 기준`,
      icon: Users,
      iconClassName: 'bg-indigo-50 text-indigo-600',
      tone: 'matchSuccess',
      todayNewCount: viewModel.statsBar.todayMatchSuccessCount,
    },
  ];
}

function buildSeasonMatchingSuccessHighlight(
  viewModel: HomeDashboardViewModel,
  daysUntilEnd: number,
): PrimarySuccessHighlight | undefined {
  const count = viewModel.statsBar.matchSuccessCount;
  if (count <= 0) {
    return undefined;
  }

  if (daysUntilEnd <= 3) {
    return {
      count,
      text: `시즌 종료까지 D-${daysUntilEnd},`,
      urgency: 'critical',
    };
  }

  if (daysUntilEnd <= 7) {
    return {
      count,
      text: `시즌 종료까지 D-${daysUntilEnd},`,
      urgency: 'warning',
    };
  }

  return {
    count,
    text: '이번 시즌, 벌써',
    urgency: 'normal',
  };
}

function buildSeasonMatchingActiveMatchPolicyHints(): PrimaryPolicyHint[] {
  return [
    {
      label: '매칭 확정',
      text: `룸메이트 매칭이 확정됐어요. 다른 유저와의 대화·매칭 요청은 닫혀요.`,
      icon: UserRoundCheck,
      iconClassName: 'text-indigo-600',
    },
    {
      label: '호실 선택',
      text: '실제 호실 선택은 룸메와 학교 홈페이지에서 진행해요.',
      icon: Building2,
      iconClassName: 'text-cyan-600',
    },
    {
      label: '채팅',
      text: '매칭 상대와의 채팅은 시즌 종료일까지 이어질 수 있어요.',
      icon: MessageCircle,
      iconClassName: 'text-blue-600',
    },
    {
      label: '매칭 해제',
      text: '해제는 양쪽이 요청해야 완료돼요. 상대와 원활한 소통으로 해결해요.',
      icon: ShieldAlert,
      iconClassName: 'text-rose-500',
    },
  ];
}

function buildSeasonMatchingRegisteredPolicyHints(): PrimaryPolicyHint[] {
  const roomSelectionText = '매칭을 확정하면 다른 사용자와의 대화·매칭 요청은 종료돼요.';

  return [
    {
      label: '룸메 후보 탐색',
      text: '생활 습관이 잘 맞는 룸메 후보를 먼저 탐색해요.',
      icon: Search,
      iconClassName: 'text-cyan-600',
    },
    {
      label: '대화로 확인',
      text: '생활 습관 외에도 대화하며 서로 잘 맞는지 확인해요.',
      icon: MessageCircle,
      iconClassName: 'text-blue-600',
    },
    {
      label: '매칭 요청',
      text: '상대에게 매칭 신청을 보내고, 받은 요청은 수락·거절할 수 있어요.',
      icon: Users,
      iconClassName: 'text-purple-600',
    },
    {
      label: '확정 전 유의',
      text: roomSelectionText,
      icon: Info,
      iconClassName: 'text-amber-500',
    },
  ];
}

function buildPostMatchDateRows(
  viewModel: HomeDashboardViewModel,
  daysUntilEnd: number,
): PrimaryDateRow[] | undefined {
  const matchingWindow = viewModel.matchingWindow;
  const rows: PrimaryDateRow[] = [];

  if (matchingWindow) {
    rows.push({
      label: '매칭 시즌',
      value: `${matchingWindow.matchingStartDate} ~ ${matchingWindow.roomSelectionDate}`,
      badge: '종료',
      tone: 'closed',
    });
  }

  if (viewModel.seasonEndDate) {
    rows.push({
      label: '시즌 종료',
      value: viewModel.seasonEndDate,
      badge: daysUntilEnd > 0 ? `D-${daysUntilEnd}` : '오늘',
      tone: daysUntilEnd <= 3 ? 'critical' : daysUntilEnd <= 7 ? 'warning' : 'normal',
    });
  }

  return rows;
}

function buildPostMatchInsights(
  viewModel: HomeDashboardViewModel,
  outcome: PostMatchPrimaryOutcome,
): PrimaryInsight[] {
  const result = resolvePostMatchResultCopy(viewModel, outcome);

  return [
    {
      label: '이번 시즌 참여자',
      value: `${viewModel.statsBar.totalCount}명`,
      helper: `${viewModel.campusName} 기준`,
      icon: UserRound,
      iconClassName: 'bg-blue-50 text-blue-600',
      tone: 'participant',
    },
    {
      label: '매칭 완료',
      value: formatPostMatchPairCount(viewModel.statsBar.matchSuccessCount),
      helper: `${viewModel.campusName} 기준`,
      icon: CheckCircle2,
      iconClassName: 'bg-green-50 text-green-600',
      tone: 'matchSuccess',
    },
    {
      label: '내 결과',
      value: result.value,
      helper: result.helper,
      icon: result.icon,
      iconClassName: result.iconClassName,
      tone: result.tone,
    },
  ];
}

function resolvePostMatchResultCopy(
  viewModel: HomeDashboardViewModel,
  outcome: PostMatchPrimaryOutcome,
): {
  value: string;
  helper: string;
  icon: LucideIcon;
  iconClassName: string;
  tone: NonNullable<PrimaryInsight['tone']>;
} {
  switch (outcome) {
    case 'matched':
      return {
        value: '매칭 확정',
        helper: `${viewModel.activeMatch?.partnerNickname ?? '상대'}님`,
        icon: UserRoundCheck,
        iconClassName: 'bg-emerald-50 text-emerald-600',
        tone: 'matchedResult',
      };
    case 'deregistered':
      return {
        value: '참여 철회',
        helper: '시즌 매칭 종료',
        icon: XCircle,
        iconClassName: 'bg-slate-100 text-slate-600',
        tone: 'neutral',
      };
    case 'not-registered':
      return {
        value: '미참여',
        helper: '시즌 매칭 종료',
        icon: Clock3,
        iconClassName: 'bg-slate-100 text-slate-600',
        tone: 'neutral',
      };
    case 'unmatched-after-success':
      return {
        value: '매칭 종료',
        helper: '기록 확인',
        icon: History,
        iconClassName: 'bg-purple-50 text-purple-600',
        tone: 'buildingOpen',
      };
    case 'not-matched':
      return {
        value: '미성사',
        helper: '활동 기록',
        icon: History,
        iconClassName: 'bg-slate-100 text-slate-600',
        tone: 'neutral',
      };
    case 'history':
      return {
        value: '기록 확인',
        helper: '결과 조회',
        icon: History,
        iconClassName: 'bg-purple-50 text-purple-600',
        tone: 'buildingOpen',
      };
  }
}

function formatPostMatchPairCount(matchSuccessParticipantCount: number): string {
  return `${Math.floor(matchSuccessParticipantCount / 2)}쌍`;
}

function buildPostMatchPolicyHints(viewModel: HomeDashboardViewModel): PrimaryPolicyHint[] {
  return [
    {
      label: '매칭 시즌 종료',
      text: '시즌 참여·새 대화 시작·매칭 요청은 닫혀요.',
      icon: XCircle,
      iconClassName: 'text-slate-600',
    },
    {
      label: '결과 확인',
      text: '매칭 결과와 이번 시즌 기록을 확인하는 기간이에요.',
      icon: History,
      iconClassName: 'text-purple-600',
    },
    {
      label: viewModel.capabilities.canStartChat ? '매칭 대화 유지' : '대화 정리',
      text: viewModel.capabilities.canStartChat
        ? '매칭된 상대와의 채팅은 시즌 종료일 전까지 가능해요.'
        : '매칭되지 않은 상대와의 채팅은 더 이상 불가능해요.',
      icon: MessageCircle,
      iconClassName: viewModel.capabilities.canStartChat ? 'text-blue-600' : 'text-slate-600',
    },
    {
      label: '시즌 종료 안내',
      text: viewModel.activeMatch
        ? '시즌 종료일 전까지 룸메와 기숙사 생활 규칙을 미리 의논해보세요.'
        : '다음 학기에는 서비스를 통해 룸메이트 매칭해보세요.',
      icon: CalendarDays,
      iconClassName: 'text-cyan-600',
    },
  ];
}
