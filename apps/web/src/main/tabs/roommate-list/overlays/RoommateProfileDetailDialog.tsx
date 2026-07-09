import { RefreshCw } from 'lucide-react';
import { BaseBottomSheet } from '@/components/BaseBottomSheet';
import {
  formatLifestyleFieldName,
  formatLifestyleOptionLabel,
} from '@/main/model/lifestyleDisplayCopy';
import {
  formatCampusName,
  formatCollegeName,
  formatGenderNoun,
  formatGradeLabel,
} from '@/main/model/profileDisplayCopy';
import { CompatibilityAxisList } from '../components/CompatibilityAxisList';
import { CompatibilityRadar } from '../components/CompatibilityRadar';
import { mapCompatibilityToChartViewModel } from '../model/compatibility/compatibilityChart.mapper';
import {
  buildPrimaryActionCopy,
  formatTargetActionUnavailableReason,
} from '../model/actions/roommateActionReasonCopy';
import type { RoommateProfileDetailState } from '../hooks/useRoommateProfileDetail';
import type { RoommateActionTargetSnapshot } from '../hooks/useRoommateActions';
import type { RoommatePendingMatchRequestViewModel } from '../model/search/roommateSearchViewModel';
import type {
  PublicProfileFullDetail,
  PublicProfileDetailLifestyle,
  PublicProfileTombstone,
} from '@repo/shared/profile/contract';
import type { LifestyleData } from '@/types/lifestyle';

interface RoommateProfileDetailDialogProps {
  readonly state: RoommateProfileDetailState;
  readonly viewerLifestyle: LifestyleData;
  readonly onClose: () => void;
  readonly onRetry: () => void;
  readonly onRefreshList: () => void;
  readonly actionPendingTargetIds?: readonly string[];
  readonly onRequestMatch?: (target: RoommateActionTargetSnapshot) => void;
  readonly onBlock?: (target: RoommateActionTargetSnapshot) => void;
  readonly onReport?: (target: RoommateActionTargetSnapshot) => void;
  readonly onStartChat?: (target: RoommateActionTargetSnapshot) => void;
  readonly onOpenMatchingRequests?: () => void;
}

interface DetailRowViewModel {
  readonly label: string;
  readonly value: string;
}

const GENERIC_ERROR_TITLE = '서버 오류로 프로필 접근에 실패했어요.';
const GENERIC_ERROR_MESSAGE = '목록을 새로고침한 뒤 다시 열람해 주세요.';

export function RoommateProfileDetailDialog({
  state,
  viewerLifestyle,
  onClose,
  onRetry,
  onRefreshList,
  actionPendingTargetIds = [],
  onRequestMatch,
  onBlock,
  onReport,
  onStartChat,
  onOpenMatchingRequests,
}: RoommateProfileDetailDialogProps) {
  return (
    <BaseBottomSheet
      isOpen={state.status !== 'closed'}
      onClose={onClose}
      title="룸메이트 상세 정보"
    >
      <div className="space-y-5 px-5 py-5">
        {state.status === 'loading' ? <DetailLoading nickname={state.target.nickname} /> : null}
        {state.status === 'error' ? (
          <DetailError
            retryable={state.error.retryable}
            onRetry={onRetry}
            onRefreshList={onRefreshList}
          />
        ) : null}
        {state.status === 'success' && state.profile.detailState === 'FULL' ? (
          <FullDetailContent
            profile={state.profile}
            viewerLifestyle={viewerLifestyle}
            pendingMatchRequest={state.target.pendingMatchRequest ?? null}
            actionPendingTargetIds={actionPendingTargetIds}
            onRequestMatch={onRequestMatch}
            onBlock={onBlock}
            onReport={onReport}
            onStartChat={onStartChat}
            onOpenMatchingRequests={onOpenMatchingRequests}
          />
        ) : null}
        {state.status === 'success' && state.profile.detailState === 'TOMBSTONE' ? (
          <TombstoneDetailContent profile={state.profile} onRefreshList={onRefreshList} />
        ) : null}
      </div>
    </BaseBottomSheet>
  );
}

function DetailLoading({ nickname }: { readonly nickname: string }) {
  return (
    <section role="status" className="rounded-3xl border border-(--knu-border) bg-white p-5">
      <p className="text-sm font-bold text-(--knu-text-primary)">
        {nickname} 상세 정보를 불러오는 중이에요.
      </p>
      <p className="mt-2 text-xs leading-5 text-(--knu-text-secondary)">
        정상 목록 진입 맥락을 확인한 뒤 공개 가능한 정보만 보여줄게요.
      </p>
    </section>
  );
}

function DetailError({
  retryable,
  onRetry,
  onRefreshList,
}: {
  readonly retryable: boolean;
  readonly onRetry: () => void;
  readonly onRefreshList: () => void;
}) {
  return (
    <section role="alert" className="rounded-3xl border border-red-100 bg-white p-5 text-center">
      <p className="text-base font-bold text-red-700">{GENERIC_ERROR_TITLE}</p>
      <p className="mt-2 text-sm leading-6 text-(--knu-text-secondary)">{GENERIC_ERROR_MESSAGE}</p>
      <div className="mt-5 grid gap-2">
        {retryable ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-(--knu-primary) px-4 py-3 text-sm font-semibold text-white"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            다시 시도
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRefreshList}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-(--knu-border) bg-white px-4 py-3 text-sm font-semibold text-(--knu-primary)"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          목록 새로고침
        </button>
      </div>
    </section>
  );
}

function FullDetailContent({
  profile,
  viewerLifestyle,
  pendingMatchRequest,
  actionPendingTargetIds,
  onRequestMatch,
  onBlock,
  onReport,
  onStartChat,
  onOpenMatchingRequests,
}: {
  readonly profile: PublicProfileFullDetail;
  readonly viewerLifestyle: LifestyleData;
  readonly pendingMatchRequest: RoommatePendingMatchRequestViewModel | null;
  readonly actionPendingTargetIds: readonly string[];
  readonly onRequestMatch?: (target: RoommateActionTargetSnapshot) => void;
  readonly onBlock?: (target: RoommateActionTargetSnapshot) => void;
  readonly onReport?: (target: RoommateActionTargetSnapshot) => void;
  readonly onStartChat?: (target: RoommateActionTargetSnapshot) => void;
  readonly onOpenMatchingRequests?: () => void;
}) {
  const compatibility = profile.compatibility
    ? mapCompatibilityToChartViewModel(profile.compatibility)
    : null;
  const identityRows = buildIdentityRows(profile);
  const targetLifestyleRows = buildTargetLifestyleRows(profile.lifestyle);
  const viewerPreferenceRows = buildViewerPreferenceRows(viewerLifestyle);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-indigo-100 bg-indigo-50/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-indigo-700">상대 프로필</p>
            <h2 className="mt-1 text-xl font-bold text-(--knu-text-primary)">{profile.nickname}</h2>
          </div>
          {typeof profile.matchScore === 'number' ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-(--knu-primary) shadow-sm">
              적합도 {profile.matchScore}점
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-sm leading-6 text-(--knu-text-secondary)">{profile.intro}</p>
      </section>

      <DetailRowsSection title="기본 정보" rows={identityRows} />

      {compatibility ? (
        <section className="space-y-4 rounded-3xl border border-indigo-100 bg-white p-4">
          <div>
            <p className="text-xs font-bold text-indigo-700">비교 결과</p>
            <h3 className="mt-1 text-base font-bold text-(--knu-text-primary)">
              상대 생활 패턴 ↔ 나의 원하는 룸메 조건 비교
            </h3>
            <p className="mt-2 text-xs leading-5 text-(--knu-text-secondary)">
              초록은 잘 맞는 축, 파랑은 대화로 조율할 수 있는 축, 슬레이트는 추가 확인이 필요한
              축이에요.
            </p>
          </div>
          <CompatibilityRadar viewModel={compatibility} />
          <CompatibilityAxisList viewModel={compatibility} />
        </section>
      ) : (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-800">
            서버 오류로 매칭점수를 제공하지 못했어요.
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-700">
            목록을 새로고침해 다시 확인해 주세요.
          </p>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <DetailRowsSection
          title="상대 생활패턴"
          description="상대가 공개한 생활패턴만 보여줘요."
          rows={targetLifestyleRows}
        />
        <DetailRowsSection
          title="나의 원하는 룸메 조건"
          description="내 시즌 프로필의 룸메 조건을 비교 기준으로 보여줘요."
          rows={viewerPreferenceRows}
        />
      </div>
      <ActionSummary
        target={{ targetUserId: profile.id, nickname: profile.nickname, actions: profile.actions }}
        pendingMatchRequest={pendingMatchRequest}
        pending={actionPendingTargetIds.includes(profile.id)}
        onRequestMatch={onRequestMatch}
        onBlock={onBlock}
        onReport={onReport}
        onStartChat={onStartChat}
        onOpenMatchingRequests={onOpenMatchingRequests}
      />
    </div>
  );
}

function TombstoneDetailContent({
  profile,
  onRefreshList,
}: {
  readonly profile: PublicProfileTombstone;
  readonly onRefreshList: () => void;
}) {
  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-center">
      <p className="text-xs font-bold text-amber-700">예외 안내</p>
      <h2 className="mt-2 text-lg font-bold text-amber-950">상대가 시즌 참여를 철회했어요.</h2>
      <p className="mt-3 text-sm leading-6 text-(--knu-text-secondary)">
        {profile.tombstone.message}
      </p>
      <p className="mt-2 text-xs leading-5 text-amber-800">
        목록을 새로고침해 현재 참여 중인 후보만 다시 확인해 주세요.
      </p>
      <button
        type="button"
        onClick={onRefreshList}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-(--knu-primary) px-4 py-3 text-sm font-semibold text-white"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        목록 새로고침
      </button>
    </section>
  );
}

function DetailRowsSection({
  title,
  description,
  rows,
}: {
  readonly title: string;
  readonly description?: string;
  readonly rows: readonly DetailRowViewModel[];
}) {
  if (rows.length === 0) return null;
  const headingId = `roommate-detail-${title.replace(/\s+/g, '-')}`;

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="mb-2 text-sm font-bold text-(--knu-text-primary)">
        {title}
      </h3>
      {description ? (
        <p className="mb-3 text-xs leading-5 text-(--knu-text-secondary)">{description}</p>
      ) : null}
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={`${row.label}-${row.value}`}
            className="rounded-2xl bg-(--knu-background-alt) px-3 py-3"
          >
            <dt className="text-xs font-bold text-(--knu-text-tertiary)">{row.label}</dt>
            <dd className="mt-1 text-sm font-semibold text-(--knu-text-secondary)">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ActionSummary({
  target,
  pendingMatchRequest,
  pending,
  onRequestMatch,
  onBlock,
  onReport,
  onStartChat,
  onOpenMatchingRequests,
}: {
  readonly target: RoommateActionTargetSnapshot;
  readonly pendingMatchRequest: RoommatePendingMatchRequestViewModel | null;
  readonly pending: boolean;
  readonly onRequestMatch?: (target: RoommateActionTargetSnapshot) => void;
  readonly onBlock?: (target: RoommateActionTargetSnapshot) => void;
  readonly onReport?: (target: RoommateActionTargetSnapshot) => void;
  readonly onStartChat?: (target: RoommateActionTargetSnapshot) => void;
  readonly onOpenMatchingRequests?: () => void;
}) {
  const label = pendingMatchRequest
    ? pendingMatchRequest.description
    : buildPrimaryActionCopy(target.actions);
  const primaryUnavailableReason = target.actions.unavailableReasons[0] ?? null;
  const directionLimitReached = target.actions.unavailableReasons.includes(
    'MATCH_REQUEST_DIRECTION_LIMIT_REACHED',
  );

  return (
    <section className="rounded-3xl border border-(--knu-border) bg-white p-4">
      <p className="text-sm font-bold text-(--knu-text-primary)">다음 행동</p>
      <p className="mt-2 text-sm leading-6 text-(--knu-text-secondary)">{label}</p>
      <div className="mt-4 grid gap-2">
        {directionLimitReached ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            이번 시즌에는 해당 유저에게 더 이상 매칭 요청을 보낼 수 없어요
          </div>
        ) : null}
        {pendingMatchRequest ? (
          pendingMatchRequest.direction === 'RECEIVED' && onOpenMatchingRequests ? (
            <button
              type="button"
              disabled={pending}
              onClick={onOpenMatchingRequests}
              className="rounded-2xl bg-(--knu-primary) px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              받은 요청 확인하기
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="rounded-2xl bg-(--knu-background-alt) px-4 py-3 text-sm font-semibold text-(--knu-text-secondary) disabled:cursor-not-allowed"
            >
              {pendingMatchRequest.direction === 'SENT'
                ? '요청 응답 대기 중'
                : '매칭 탭에서 확인할 수 있어요'}
            </button>
          )
        ) : target.actions.canRequestMatch && onRequestMatch ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => onRequestMatch(target)}
            className="rounded-2xl bg-(--knu-primary) px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? '요청 처리 중' : '매칭 요청 보내기'}
          </button>
        ) : directionLimitReached ? (
          <button
            type="button"
            disabled
            className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 disabled:cursor-not-allowed"
          >
            매칭 요청 횟수 초과
          </button>
        ) : target.actions.canStartChat && onStartChat ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => onStartChat(target)}
            className="rounded-2xl bg-(--knu-primary) px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            대화 화면에서 이어가기
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="rounded-2xl bg-(--knu-background-alt) px-4 py-3 text-sm font-semibold text-(--knu-text-secondary) disabled:cursor-not-allowed"
          >
            {primaryUnavailableReason
              ? formatTargetActionUnavailableReason(primaryUnavailableReason)
              : '지금 가능한 주요 행동이 없어요'}
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          {onReport ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onReport(target)}
              className="rounded-2xl border border-(--knu-border) bg-white px-4 py-3 text-sm font-semibold text-(--knu-text-secondary) disabled:cursor-not-allowed disabled:opacity-60"
            >
              신고하기
            </button>
          ) : null}
          {onBlock ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onBlock(target)}
              className="rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              차단하기
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function buildIdentityRows(profile: PublicProfileFullDetail): readonly DetailRowViewModel[] {
  return [
    {
      label: '성별',
      value: formatGenderNoun(profile.gender),
    },
    { label: '캠퍼스', value: formatCampusName(profile.campus) },
    { label: '단과대', value: formatCollegeName(profile.additional.college, '비공개') },
    { label: '학년', value: formatGradeLabel(profile.additional.grade, '비공개') },
    { label: 'MBTI', value: profile.additional.mbti ?? '비공개' },
  ];
}

const TARGET_LIFESTYLE_FIELDS = [
  'bedtime',
  'wakeTime',
  'sleepHabit',
  'sleepEnvironment',
  'screenUsage',
  'noiseSensitivity',
  'smokingBehavior',
  'indoorEating',
  'phoneBehavior',
  'earphoneUsage',
  'cleanLevel',
  'relationshipStyle',
  'temperatureSensitivity',
] as const satisfies readonly (keyof PublicProfileDetailLifestyle)[];

const VIEWER_PREFERENCE_FIELDS = [
  'smokingTolerance',
  'phoneTolerance',
  'earphoneExpectation',
  'sleepEnvPreference',
  'screenTolerance',
  'indoorEatingTolerance',
  'cleanExpectation',
] as const satisfies readonly (keyof LifestyleData)[];

function buildTargetLifestyleRows(
  lifestyle: PublicProfileDetailLifestyle,
): readonly DetailRowViewModel[] {
  return TARGET_LIFESTYLE_FIELDS.map((field) => ({
    label: formatLifestyleFieldName(field),
    value: formatLifestyleOptionLabel(field, lifestyle[field]),
  }));
}

function buildViewerPreferenceRows(lifestyle: LifestyleData): readonly DetailRowViewModel[] {
  return [
    ...VIEWER_PREFERENCE_FIELDS.map((field) => ({
      label: formatLifestyleFieldName(field),
      value: formatLifestyleOptionLabel(field, lifestyle[field]),
    })),
    {
      label: '음주',
      value: '정책상 비교 상세에서는 제외',
    },
  ];
}
