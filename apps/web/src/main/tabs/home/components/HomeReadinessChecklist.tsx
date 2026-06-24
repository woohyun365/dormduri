'use client';

import { CheckCircle2, CircleAlert, CircleDashed } from 'lucide-react';
import { sectionCard, sectionHeader } from '@/main/styles/home';
import type { HomeDashboardResponse } from '@repo/shared/home';
import type { TabId, MatchingNavOptions } from '@/types/profile';
import type { HomeDashboardViewModel } from '../model/homeDashboardViewModel';

type ChecklistStatus = 'complete' | 'actionable' | 'locked';

type ChecklistActionTarget = 'profile' | 'building' | 'list';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  status: ChecklistStatus;
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

  return (
    <section className={sectionCard()} aria-labelledby="home-readiness-title">
      <div className={sectionHeader}>
        <div>
          <p className="mb-1 text-xs font-bold text-(--knu-primary)">준비 체크리스트</p>
          <h2 id="home-readiness-title" className="font-bold text-(--knu-text-primary)">
            다음 행동을 한눈에 확인해요
          </h2>
        </div>
        <CheckCircle2 className="w-5 h-5 text-(--knu-primary)" aria-hidden="true" />
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
    return [
      {
        id: 'no-current-season',
        title: '새 시즌 일정 대기',
        description:
          '현재는 새 시즌 참여 등록이 열려 있지 않아요. 프로필을 정비하고 다음 안내를 기다려 주세요.',
        status: 'locked',
        actionLabel: '내 프로필 확인',
        actionTarget: 'profile',
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

  return [
    {
      id: 'profile',
      title: profileReady ? '생활패턴 준비 완료' : '생활패턴을 먼저 채워요',
      description: profileReady
        ? '시즌 참여에 필요한 생활패턴과 조건이 준비되어 있어요.'
        : '수면·생활패턴과 원하는 룸메 조건을 채우면 등록 준비가 진행돼요.',
      status: profileReady
        ? 'complete'
        : capabilities.canCreateOrUpdateSeasonProfileDraft || seasonProfile.draftWritable
          ? 'actionable'
          : 'locked',
      actionLabel: profileReady ? undefined : '생활패턴 입력',
      actionTarget: profileReady ? undefined : 'profile',
    },
    {
      id: 'building',
      title: buildingReady ? '건물 선택 완료' : '배정 건물을 선택해요',
      description: buildingReady
        ? '같은 건물 기준으로 룸메 탐색과 매칭 흐름을 안내할 수 있어요.'
        : '건물을 선택해야 같은 건물 후보 탐색과 매칭 요청이 가능해져요.',
      status: buildingReady
        ? 'complete'
        : capabilities.canSelectDormitory || seasonProfile.canSelectDormitory
          ? 'actionable'
          : 'locked',
      actionLabel: buildingReady ? undefined : '건물 선택',
      actionTarget: buildingReady ? undefined : 'building',
    },
    {
      id: 'registration',
      title: registrationReady ? '시즌 등록 완료' : '시즌 등록을 마무리해요',
      description: registrationReady
        ? '현재 시즌 참여 등록이 완료되어 시즌 상태에 맞는 기능을 이용할 수 있어요.'
        : '생활패턴과 건물 선택이 준비되면 시즌 등록을 확정할 수 있어요.',
      status: registrationReady
        ? 'complete'
        : capabilities.canFinalizeSeasonRegistration || seasonProfile.canFinalizeRegistration
          ? 'actionable'
          : 'locked',
      actionLabel: registrationReady ? undefined : '등록 상태 확인',
      actionTarget: registrationReady ? undefined : 'profile',
    },
    {
      id: 'matching',
      title: capabilities.canEnterRoommateSearch ? '룸메 탐색 가능' : '룸메 탐색 대기',
      description: capabilities.canEnterRoommateSearch
        ? '이제 같은 건물 후보를 확인하고 대화나 매칭 요청을 시작할 수 있어요.'
        : '시즌 상태와 등록 상태가 맞아야 룸메 탐색이 열려요.',
      status: capabilities.canEnterRoommateSearch ? 'actionable' : 'locked',
      actionLabel: capabilities.canEnterRoommateSearch ? '룸메 찾기' : undefined,
      actionTarget: capabilities.canEnterRoommateSearch ? 'list' : undefined,
    },
  ];
}

function ReadinessItem({ item, onAction }: { item: ChecklistItem; onAction: () => void }) {
  const status = STATUS_COPY[item.status];
  const Icon = STATUS_ICON[item.status];

  return (
    <li className="rounded-xl border border-(--knu-border) bg-(--knu-background-alt) p-3">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${status.iconClass}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-(--knu-text-primary)">{item.title}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${status.badgeClass}`}>
              {status.label}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-(--knu-text-secondary)">
            {item.description}
          </p>
          {item.actionLabel && (
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
  locked: CircleAlert,
};

const STATUS_COPY: Record<
  ChecklistStatus,
  { label: string; iconClass: string; badgeClass: string }
> = {
  complete: {
    label: '완료',
    iconClass: 'bg-green-50 text-green-600',
    badgeClass: 'bg-green-50 text-green-700',
  },
  actionable: {
    label: '진행 가능',
    iconClass: 'bg-blue-50 text-blue-600',
    badgeClass: 'bg-blue-50 text-blue-700',
  },
  locked: {
    label: '대기',
    iconClass: 'bg-amber-50 text-amber-700',
    badgeClass: 'bg-amber-50 text-amber-800',
  },
};
