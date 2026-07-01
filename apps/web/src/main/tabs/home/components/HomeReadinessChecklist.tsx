'use client';

import { CalendarDays, CheckCircle2, CircleDashed, Clock3 } from 'lucide-react';
import { sectionCard, sectionHeader } from '@/main/styles/home';
import type { HomeDashboardResponse } from '@repo/shared/home';
import type { TabId, MatchingNavOptions } from '@/types/profile';
import { formatDateDot } from '../model/homeDateDisplay';
import type { HomeDashboardViewModel } from '../model/homeDashboardViewModel';

type ChecklistStatus = 'complete' | 'actionable' | 'locked' | 'info';

type ChecklistActionTarget = 'profile' | 'building' | 'list';

type ChecklistIcon = 'clock' | 'progress';
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

export function HomeReadinessChecklist({
  dashboard,
  viewModel,
  onNavigate,
  onOpenBuildingSelect,
}: HomeReadinessChecklistProps) {
  const items = buildReadinessChecklistItems({ dashboard, viewModel });
  const isSchedulePreview = !viewModel.hasCurrentSeason && viewModel.isCampusOperated;

  return (
    <section className={sectionCard()} aria-labelledby="home-readiness-title">
      <div className={sectionHeader}>
        <div>
          <p className="mb-1 text-xs font-bold text-(--knu-primary)">
            {isSchedulePreview ? '시즌 일정' : '시즌 참여 준비'}
          </p>
          <h2 id="home-readiness-title" className="font-bold text-(--knu-text-primary)">
            {isSchedulePreview ? '다음 시즌 안내를 확인해요' : '신청 전 필요한 항목을 확인해요'}
          </h2>
        </div>
        {isSchedulePreview ? (
          <CalendarDays className="w-5 h-5 text-(--knu-primary)" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-(--knu-primary)" aria-hidden="true" />
        )}
      </div>

      <ol className="space-y-3">
        {items.map((item) => (
          <ReadinessItem
            key={item.id}
            item={item}
            onAction={() => {
              if (item.actionTarget === 'building') {
                onOpenBuildingSelect?.();
                return;
              }
              if (item.actionTarget === 'list') {
                onNavigate('list');
                return;
              }
              onNavigate('profile');
            }}
          />
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

  const seasonProfile = dashboard.viewer.seasonProfile;
  const capabilities = dashboard.viewer.capabilities;
  const profileReady =
    seasonProfile.registered || !seasonProfile.completion.profileCompletionRequired;
  const buildingReady =
    seasonProfile.registered || !seasonProfile.completion.dormitorySelectionRequired;
  const registrationReady = seasonProfile.registered;
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
      description: '생활패턴과 기숙사 설정을 확인한 뒤 시즌 참여 신청을 마무리해요.',
      status: registrationReady
        ? 'complete'
        : capabilities.canFinalizeSeasonRegistration || seasonProfile.canFinalizeRegistration
          ? 'actionable'
          : 'locked',
      icon: 'progress',
      actionLabel: registrationReady ? undefined : '시즌 참여 신청',
      actionTarget: registrationReady ? undefined : 'profile',
    },
  ];
}

function ReadinessItem({ item, onAction }: { item: ChecklistItem; onAction: () => void }) {
  const status = STATUS_COPY[item.status];
  const visual = item.tone ? TONE_COPY[item.tone] : status;
  const shouldRenderAction = item.status !== 'locked' && Boolean(item.actionLabel);
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
          {shouldRenderAction && (
            <button
              type="button"
              onClick={onAction}
              className="mt-2 inline-flex min-h-9 items-center justify-center rounded-lg bg-white px-3 text-xs font-bold text-(--knu-primary) ring-1 ring-(--knu-border) transition-colors hover:bg-blue-50"
            >
              {item.actionLabel}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

const STATUS_ICON: Record<ChecklistStatus, typeof CheckCircle2> = {
  complete: CheckCircle2,
  actionable: CircleDashed,
  locked: Clock3,
  info: CalendarDays,
};

const CHECKLIST_ICON: Record<ChecklistIcon, typeof CheckCircle2> = {
  clock: Clock3,
  progress: CircleDashed,
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
  info: {
    label: '확인 가능',
    iconClass: 'bg-slate-100 text-slate-600',
    badgeClass: 'bg-slate-100 text-slate-700',
    itemClass: 'border-(--knu-border) bg-(--knu-background-alt)',
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
