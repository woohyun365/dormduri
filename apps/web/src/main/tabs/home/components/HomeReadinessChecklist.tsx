'use client';

import {
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Clock3,
  History,
  Lock,
  MessageCircle,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { sectionCard, sectionHeader } from '@/main/styles/home';
import type { HomeDashboardResponse } from '@repo/shared/home';
import type { TabId, MatchingNavOptions } from '@/types/profile';
import { formatDateDot } from '../model/homeDateDisplay';
import type { HomeDashboardViewModel } from '../model/homeDashboardViewModel';

type ChecklistStatus =
  | 'complete'
  | 'actionable'
  | 'locked'
  | 'blocked'
  | 'readonly'
  | 'closed'
  | 'maintained';

type ChecklistActionTarget = 'profile' | 'building' | 'list';

type ChecklistIcon = 'clock' | 'progress' | 'lock' | 'history' | 'chat' | 'closed';
type ChecklistTone = 'amber';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  status: ChecklistStatus;
  icon?: ChecklistIcon;
  tone?: ChecklistTone;
  actionLabel?: string;
  actionTarget?: ChecklistActionTarget;
}

interface HomeReadinessChecklistProps {
  dashboard: HomeDashboardResponse;
  viewModel: HomeDashboardViewModel;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  onOpenBuildingSelect?: () => void;
}

export function HomeReadinessChecklist({ dashboard, viewModel }: HomeReadinessChecklistProps) {
  const items = buildReadinessChecklistItems({ dashboard, viewModel });
  const isSchedulePreview = !viewModel.hasCurrentSeason && viewModel.isCampusOperated;
  const isPostMatch = viewModel.seasonState === 'SEASON_POST_MATCH';

  return (
    <section className={sectionCard()} aria-labelledby="home-readiness-title">
      <div className={sectionHeader}>
        <div>
          <p className="mb-1 text-xs font-bold text-(--knu-primary)">
            {isSchedulePreview ? '시즌 일정' : isPostMatch ? '마감 정리 안내' : '시즌 참여 준비'}
          </p>
          <h2 id="home-readiness-title" className="font-bold text-(--knu-text-primary)">
            {isSchedulePreview
              ? '다음 시즌 안내를 확인해요'
              : isPostMatch
                ? '결과 확인 항목을 확인해요'
                : '신청 전 필요한 항목을 확인해요'}
          </h2>
        </div>
        {isSchedulePreview ? (
          <CalendarDays className="w-5 h-5 text-(--knu-primary)" aria-hidden="true" />
        ) : isPostMatch ? (
          <History className="w-5 h-5 text-(--knu-primary)" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-(--knu-primary)" aria-hidden="true" />
        )}
      </div>

      <ol className="space-y-3">
        {items.map((item) => (
          <ReadinessItem key={item.id} item={item} />
        ))}
      </ol>
    </section>
  );
}

export function buildReadinessChecklistItems({
  dashboard,
  viewModel,
}: {
  dashboard: HomeDashboardResponse;
  viewModel: HomeDashboardViewModel;
}): ChecklistItem[] {
  if (!viewModel.isCampusOperated) {
    return [
      {
        id: 'campus',
        title: '서비스 운영 대기',
        description: `${viewModel.campusName} 캠퍼스는 아직 운영 준비 중이에요. 계정 정보만 먼저 확인할 수 있어요.`,
        status: 'locked',
        actionLabel: '내 정보 확인',
        actionTarget: 'profile',
      },
    ];
  }

  if (!viewModel.hasCurrentSeason) {
    const preview = dashboard.nextSeasonPreview?.visibleToUser ? dashboard.nextSeasonPreview : null;

    if (!preview) {
      return [
        {
          id: 'no-next-season',
          title: '다음 시즌 일정 공개 전',
          description: '시즌 준비 중이에요. 다음 시즌에 만나요.',
          status: 'locked',
          icon: 'clock',
        },
      ];
    }

    return [
      {
        id: 'next-season-schedule',
        title: `${preview.name} 시즌 시작`,
        description: `${formatDateDot(preview.preparationStartDate)} 부터 시즌에 참여할 수 있어요.`,
        status: 'locked',
        icon: 'clock',
      },
      {
        id: 'next-season-profile',
        title: '시즌 프로필 준비',
        description: '시즌이 열리면 생활패턴과 원하는 룸메 조건을 입력할 수 있어요.',
        status: 'locked',
        icon: 'clock',
      },
      {
        id: 'next-season-building',
        title: '배정된 기숙사 선택',
        description: '자신이 이번 학기 배정된 기숙사 건물을 등록해요.',
        status: 'locked',
        icon: 'clock',
      },
      {
        id: 'next-season-matching',
        title: '시즌 참여 신청',
        description: '생활패턴과 기숙사 설정을 확인한 뒤 시즌 참여 신청을 마무리해요.',
        status: 'locked',
        icon: 'clock',
      },
    ];
  }

  if (dashboard.season.state === 'SEASON_POST_MATCH') {
    return buildPostMatchChecklistItems({ dashboard });
  }

  const seasonProfile = dashboard.viewer.seasonProfile;
  const capabilities = dashboard.viewer.capabilities;
  const profileReady =
    seasonProfile.registered || !seasonProfile.completion.profileCompletionRequired;
  const buildingReady =
    seasonProfile.registered || !seasonProfile.completion.dormitorySelectionRequired;
  const registrationReady = seasonProfile.registered;
  const registrationUnavailableReasons = seasonProfile.completion.registrationUnavailableReasons;
  const participationLocked = registrationUnavailableReasons.includes('WITHDRAWN_OR_DECLINED_LOCK');
  const currentSeasonName = dashboard.season.summary?.name ?? '이번 시즌';

  return [
    {
      id: 'matching-season',
      title: `${currentSeasonName} 시즌 매칭`,
      description: viewModel.preparation.seasonStartDate
        ? `${viewModel.preparation.seasonStartDate} 부터 매칭에 참여할 수 있어요.`
        : '시즌 참여 후 매칭 기간에 요청을 보낼 수 있어요.',
      status: 'locked',
      icon: 'clock',
      tone: registrationReady ? 'amber' : undefined,
    },
    {
      id: 'profile',
      title: '시즌 프로필 준비',
      description: '생활패턴과 원하는 룸메 조건을 입력할 수 있어요.',
      status: profileReady
        ? 'complete'
        : capabilities.canCreateOrUpdateSeasonProfileDraft || seasonProfile.draftWritable
          ? 'actionable'
          : 'locked',
      icon: 'progress',
      actionLabel: profileReady ? undefined : '시즌 프로필 설정',
      actionTarget: profileReady ? undefined : 'profile',
    },
    {
      id: 'building',
      title: '배정된 기숙사 선택',
      description: '자신이 이번 학기 배정된 기숙사 건물을 등록해요.',
      status: buildingReady
        ? 'complete'
        : capabilities.canSelectDormitory || seasonProfile.canSelectDormitory
          ? 'actionable'
          : 'locked',
      icon: 'progress',
      actionLabel: buildingReady ? undefined : '기숙사 설정',
      actionTarget: buildingReady ? undefined : 'building',
    },
    {
      id: 'registration',
      title: '시즌 참여 신청',
      description: participationLocked
        ? '시즌 재참여가 필요한 경우 문의하기를 이용해주세요.'
        : '생활패턴과 기숙사 설정을 확인한 뒤 시즌 참여 신청을 마무리해요.',
      status: registrationReady
        ? 'complete'
        : participationLocked
          ? 'blocked'
          : capabilities.canFinalizeSeasonRegistration || seasonProfile.canFinalizeRegistration
            ? 'actionable'
            : 'locked',
      icon: participationLocked ? 'lock' : 'progress',
      actionLabel: registrationReady || participationLocked ? undefined : '시즌 참여 신청',
      actionTarget: registrationReady || participationLocked ? undefined : 'profile',
    },
  ];
}

function buildPostMatchChecklistItems({
  dashboard,
}: {
  dashboard: HomeDashboardResponse;
}): ChecklistItem[] {
  const hasMatchedChat =
    dashboard.viewer.capabilities.canStartChat &&
    (dashboard.viewer.match.hasActiveMatch || dashboard.matching.activeMatch !== null);

  return [
    {
      id: 'post-match-actions-closed',
      title: '새 참여·매칭 요청 종료',
      description: '시즌 참여·매칭 요청은 마감 정리 기간에 닫혀요.',
      status: 'closed',
      icon: 'closed',
    },
    {
      id: 'post-match-activity-read',
      title: '이번 시즌 활동 확인',
      description: '시즌 참여 여부와 요청·대화·매칭 결과를 확인해요.',
      status: 'readonly',
      icon: 'history',
    },
    {
      id: 'post-match-matched-chat',
      title: '매칭 상대 채팅 유지',
      description: '매칭된 룸메와의 채팅은 시즌 종료일까지 가능해요.',
      status: hasMatchedChat ? 'maintained' : 'closed',
      icon: 'chat',
    },
    {
      id: 'post-match-nonmatched-chat-closed',
      title: '비매칭 대화 정리',
      description: '매칭 상대 외의 대화는 읽기 전용으로 변경돼요.',
      status: 'readonly',
      icon: 'chat',
    },
  ];
}

function ReadinessItem({ item }: { item: ChecklistItem }) {
  const status = STATUS_COPY[item.status];
  const visual = item.tone ? TONE_COPY[item.tone] : status;
  const Icon =
    item.status === 'complete'
      ? STATUS_ICON.complete
      : item.icon
        ? CHECKLIST_ICON[item.icon]
        : STATUS_ICON[item.status];

  return (
    <li className={`rounded-xl border p-3 ${visual.itemClass}`}>
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${visual.iconClass}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-(--knu-text-primary)">{item.title}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${visual.badgeClass}`}>
              {status.label}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-(--knu-text-secondary)">
            {item.description}
          </p>
        </div>
      </div>
    </li>
  );
}

const STATUS_ICON: Record<ChecklistStatus, LucideIcon> = {
  complete: CheckCircle2,
  actionable: CircleDashed,
  locked: Clock3,
  blocked: Lock,
  readonly: History,
  closed: XCircle,
  maintained: MessageCircle,
};

const CHECKLIST_ICON: Record<ChecklistIcon, LucideIcon> = {
  clock: Clock3,
  progress: CircleDashed,
  lock: Lock,
  history: History,
  chat: MessageCircle,
  closed: XCircle,
};

const STATUS_COPY: Record<
  ChecklistStatus,
  { label: string; iconClass: string; badgeClass: string; itemClass: string }
> = {
  complete: {
    label: '완료',
    iconClass: 'bg-green-50 text-green-600',
    badgeClass: 'bg-green-50 text-green-700',
    itemClass: 'border-(--knu-border) bg-(--knu-background-alt)',
  },
  actionable: {
    label: '진행 가능',
    iconClass: 'bg-amber-50 text-amber-700',
    badgeClass: 'bg-amber-50 text-amber-800',
    itemClass: 'border-(--knu-border) bg-(--knu-background-alt)',
  },
  locked: {
    label: '대기',
    iconClass: 'bg-slate-100 text-slate-600',
    badgeClass: 'bg-slate-100 text-slate-700',
    itemClass: 'border-(--knu-border) bg-(--knu-background-alt)',
  },
  blocked: {
    label: '불가',
    iconClass: 'bg-rose-50 text-rose-600',
    badgeClass: 'bg-rose-50 text-rose-700',
    itemClass: 'border-rose-100 bg-rose-50/60',
  },
  readonly: {
    label: '확인',
    iconClass: 'bg-purple-50 text-purple-600',
    badgeClass: 'bg-purple-50 text-purple-700',
    itemClass: 'border-purple-100 bg-purple-50/50',
  },
  closed: {
    label: '닫힘',
    iconClass: 'bg-slate-100 text-slate-600',
    badgeClass: 'bg-slate-100 text-slate-700',
    itemClass: 'border-slate-200 bg-slate-50/70',
  },
  maintained: {
    label: '유지',
    iconClass: 'bg-blue-50 text-blue-600',
    badgeClass: 'bg-blue-50 text-blue-700',
    itemClass: 'border-blue-100 bg-blue-50/50',
  },
};

const TONE_COPY: Record<
  ChecklistTone,
  { iconClass: string; badgeClass: string; itemClass: string }
> = {
  amber: {
    iconClass: 'bg-amber-100 text-amber-700',
    badgeClass: 'bg-amber-100 text-amber-800',
    itemClass: 'border-amber-100 bg-amber-50/70',
  },
};
