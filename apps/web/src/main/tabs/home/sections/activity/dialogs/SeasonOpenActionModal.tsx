import { useState } from 'react';
import { ClipboardCheck, ListChecks, UserRound, XCircle } from 'lucide-react';
import { HomeResponsiveSheet } from '../../../overlays/HomeResponsiveSheet';
import { DetailRow } from '../ActivityDetailRows';
import { SeasonProfileDetailContent } from '../../../profile-modals/HomeProfileDetailContent';
import { useCurrentSeasonProfileDetail } from '../../../profile-modals/useHomeProfileDetail';
import type { TabId, MatchingNavOptions } from '@/types/profile';
import type { HomeDashboardViewModel } from '../../../model/homeDashboardViewModel';
import type { SeasonOpenModalKind } from '../model/activityTypes';

export function SeasonOpenActionModal({
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
  const shouldLoadSeasonProfile =
    kind === 'profile-composition' ||
    kind === 'registration-confirmation' ||
    kind === 'profile-view';
  const seasonProfileState = useCurrentSeasonProfileDetail(shouldLoadSeasonProfile);

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

      {shouldLoadSeasonProfile && (
        <SeasonProfileDetailContent state={seasonProfileState} fallbackRows={content.rows} />
      )}

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
