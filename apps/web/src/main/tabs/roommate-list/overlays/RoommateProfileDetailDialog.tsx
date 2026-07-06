import { BaseBottomSheet } from '@/components/BaseBottomSheet';
import { CompatibilityAxisList } from '../components/CompatibilityAxisList';
import { CompatibilityRadar } from '../components/CompatibilityRadar';
import { mapCompatibilityToChartViewModel } from '../model/compatibility/compatibilityChart.mapper';
import {
  buildPrimaryActionCopy,
  formatTargetActionUnavailableReason,
} from '../model/actions/roommateActionReasonCopy';
import type { RoommateProfileDetailState } from '../hooks/useRoommateProfileDetail';
import type { RoommateActionTargetSnapshot } from '../hooks/useRoommateActions';
import type {
  PublicProfileFullDetail,
  PublicProfileTombstone,
} from '@repo/shared/profile/contract';

interface RoommateProfileDetailDialogProps {
  readonly state: RoommateProfileDetailState;
  readonly onClose: () => void;
  readonly onRetry: () => void;
  readonly onRefreshList: () => void;
  readonly actionPendingTargetIds?: readonly string[];
  readonly onRequestMatch?: (target: RoommateActionTargetSnapshot) => void;
  readonly onBlock?: (target: RoommateActionTargetSnapshot) => void;
  readonly onReport?: (target: RoommateActionTargetSnapshot) => void;
  readonly onStartChat?: (target: RoommateActionTargetSnapshot) => void;
}

interface DetailRowViewModel {
  readonly label: string;
  readonly value: string;
}

const GENERIC_ERROR_TITLE = '상세 정보를 다시 확인할 수 없어요.';
const GENERIC_ERROR_MESSAGE =
  '목록 이후 공개 상태가 바뀌었을 수 있어요. 대상 존재 여부나 숨김 사유는 추가로 표시하지 않아요.';

export function RoommateProfileDetailDialog({
  state,
  onClose,
  onRetry,
  onRefreshList,
  actionPendingTargetIds = [],
  onRequestMatch,
  onBlock,
  onReport,
  onStartChat,
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
            actionPendingTargetIds={actionPendingTargetIds}
            onRequestMatch={onRequestMatch}
            onBlock={onBlock}
            onReport={onReport}
            onStartChat={onStartChat}
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
    <section role="status" className="rounded-3xl border border-[var(--knu-border)] bg-white p-5">
      <p className="text-sm font-bold text-[var(--knu-text-primary)]">
        {nickname} 상세 정보를 불러오는 중이에요.
      </p>
      <p className="mt-2 text-xs leading-5 text-[var(--knu-text-secondary)]">
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
      <p className="mt-2 text-sm leading-6 text-[var(--knu-text-secondary)]">
        {GENERIC_ERROR_MESSAGE}
      </p>
      <div className="mt-5 grid gap-2">
        {retryable ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-2xl bg-[var(--knu-primary)] px-4 py-3 text-sm font-semibold text-white"
          >
            다시 시도
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRefreshList}
          className="rounded-2xl border border-[var(--knu-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--knu-primary)]"
        >
          목록 새로고침
        </button>
      </div>
    </section>
  );
}

function FullDetailContent({
  profile,
  actionPendingTargetIds,
  onRequestMatch,
  onBlock,
  onReport,
  onStartChat,
}: {
  readonly profile: PublicProfileFullDetail;
  readonly actionPendingTargetIds: readonly string[];
  readonly onRequestMatch?: (target: RoommateActionTargetSnapshot) => void;
  readonly onBlock?: (target: RoommateActionTargetSnapshot) => void;
  readonly onReport?: (target: RoommateActionTargetSnapshot) => void;
  readonly onStartChat?: (target: RoommateActionTargetSnapshot) => void;
}) {
  const compatibility = profile.compatibility
    ? mapCompatibilityToChartViewModel(profile.compatibility)
    : null;
  const identityRows = buildIdentityRows(profile);
  const lifestyleRows = buildLifestyleRows(profile);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-indigo-100 bg-indigo-50/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-indigo-700">상대 프로필</p>
            <h2 className="mt-1 text-xl font-bold text-[var(--knu-text-primary)]">
              {profile.nickname}
            </h2>
          </div>
          {typeof profile.matchScore === 'number' ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--knu-primary)] shadow-sm">
              적합도 {profile.matchScore}점
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-sm leading-6 text-[var(--knu-text-secondary)]">{profile.intro}</p>
      </section>

      <DetailRowsSection title="기본 정보" rows={identityRows} />

      {compatibility ? (
        <div className="space-y-4">
          <CompatibilityRadar viewModel={compatibility} />
          <CompatibilityAxisList viewModel={compatibility} />
        </div>
      ) : (
        <section className="rounded-3xl border border-[var(--knu-border)] bg-white p-4">
          <p className="text-sm font-semibold text-[var(--knu-text-primary)]">
            상세 적합도는 현재 제공되지 않아요.
          </p>
        </section>
      )}

      <DetailRowsSection title="공개 생활패턴" rows={lifestyleRows} />
      <ActionSummary
        target={{ targetUserId: profile.id, nickname: profile.nickname, actions: profile.actions }}
        pending={actionPendingTargetIds.includes(profile.id)}
        onRequestMatch={onRequestMatch}
        onBlock={onBlock}
        onReport={onReport}
        onStartChat={onStartChat}
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
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center">
      <p className="text-xs font-bold text-slate-500">상세 안내</p>
      <h2 className="mt-2 text-lg font-bold text-[var(--knu-text-primary)]">
        {profile.tombstone.displayName}
      </h2>
      <p className="mt-3 text-sm leading-6 text-[var(--knu-text-secondary)]">
        {profile.tombstone.message}
      </p>
      <p className="mt-2 text-xs leading-5 text-[var(--knu-text-tertiary)]">
        retained payload를 복원하지 않고 현재 공개 가능한 안내만 표시해요.
      </p>
      <div className="mt-4 rounded-2xl bg-white px-3 py-3 text-left">
        <p className="text-xs font-bold text-[var(--knu-text-tertiary)]">다음 행동</p>
        <p className="mt-1 text-sm leading-6 text-[var(--knu-text-secondary)]">
          {buildPrimaryActionCopy(profile.actions)}
        </p>
      </div>
      <button
        type="button"
        onClick={onRefreshList}
        className="mt-5 rounded-2xl bg-[var(--knu-primary)] px-4 py-3 text-sm font-semibold text-white"
      >
        목록 새로고침
      </button>
    </section>
  );
}

function DetailRowsSection({
  title,
  rows,
}: {
  readonly title: string;
  readonly rows: readonly DetailRowViewModel[];
}) {
  if (rows.length === 0) return null;
  const headingId = `roommate-detail-${title.replace(/\s+/g, '-')}`;

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="mb-2 text-sm font-bold text-[var(--knu-text-primary)]">
        {title}
      </h3>
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={`${row.label}-${row.value}`}
            className="rounded-2xl bg-[var(--knu-background-alt)] px-3 py-3"
          >
            <dt className="text-xs font-bold text-[var(--knu-text-tertiary)]">{row.label}</dt>
            <dd className="mt-1 text-sm font-semibold text-[var(--knu-text-secondary)]">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ActionSummary({
  target,
  pending,
  onRequestMatch,
  onBlock,
  onReport,
  onStartChat,
}: {
  readonly target: RoommateActionTargetSnapshot;
  readonly pending: boolean;
  readonly onRequestMatch?: (target: RoommateActionTargetSnapshot) => void;
  readonly onBlock?: (target: RoommateActionTargetSnapshot) => void;
  readonly onReport?: (target: RoommateActionTargetSnapshot) => void;
  readonly onStartChat?: (target: RoommateActionTargetSnapshot) => void;
}) {
  const label = buildPrimaryActionCopy(target.actions);
  const primaryUnavailableReason = target.actions.unavailableReasons[0] ?? null;

  return (
    <section className="rounded-3xl border border-[var(--knu-border)] bg-white p-4">
      <p className="text-sm font-bold text-[var(--knu-text-primary)]">다음 행동</p>
      <p className="mt-2 text-sm leading-6 text-[var(--knu-text-secondary)]">{label}</p>
      <div className="mt-4 grid gap-2">
        {target.actions.canRequestMatch && onRequestMatch ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => onRequestMatch(target)}
            className="rounded-2xl bg-[var(--knu-primary)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? '요청 처리 중' : '매칭 요청 보내기'}
          </button>
        ) : target.actions.canStartChat && onStartChat ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => onStartChat(target)}
            className="rounded-2xl bg-[var(--knu-primary)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            대화 화면에서 이어가기
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="rounded-2xl bg-[var(--knu-background-alt)] px-4 py-3 text-sm font-semibold text-[var(--knu-text-secondary)] disabled:cursor-not-allowed"
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
              className="rounded-2xl border border-[var(--knu-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--knu-text-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
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
      value: profile.gender === 'F' ? '여성' : profile.gender === 'M' ? '남성' : profile.gender,
    },
    { label: '캠퍼스', value: profile.campus === 'CHUNCHEON' ? '춘천캠퍼스' : profile.campus },
    { label: '단과대', value: profile.additional.college ?? '비공개' },
    {
      label: '학년',
      value: profile.additional.grade ? `${profile.additional.grade}학년` : '비공개',
    },
    { label: 'MBTI', value: profile.additional.mbti ?? '비공개' },
  ];
}

function buildLifestyleRows(profile: PublicProfileFullDetail): readonly DetailRowViewModel[] {
  const lifestyle = profile.lifestyle;
  return [
    { label: '취침 시간', value: lifestyleValueLabel(lifestyle.bedtime) },
    { label: '기상 시간', value: lifestyleValueLabel(lifestyle.wakeTime) },
    { label: '잠버릇', value: lifestyleValueLabel(lifestyle.sleepHabit) },
    { label: '수면 환경', value: lifestyleValueLabel(lifestyle.sleepEnvironment) },
    { label: '화면 사용', value: lifestyleValueLabel(lifestyle.screenUsage) },
    { label: '소음 민감도', value: lifestyleValueLabel(lifestyle.noiseSensitivity) },
    { label: '흡연', value: lifestyleValueLabel(lifestyle.smokingBehavior) },
    { label: '실내 취식', value: lifestyleValueLabel(lifestyle.indoorEating) },
    { label: '통화', value: lifestyleValueLabel(lifestyle.phoneBehavior) },
    { label: '이어폰', value: lifestyleValueLabel(lifestyle.earphoneUsage) },
    { label: '청소', value: lifestyleValueLabel(lifestyle.cleanLevel) },
    { label: '관계 스타일', value: lifestyleValueLabel(lifestyle.relationshipStyle) },
    { label: '온도 민감도', value: lifestyleValueLabel(lifestyle.temperatureSensitivity) },
  ];
}

function lifestyleValueLabel(value: string | null): string {
  if (!value) return '비공개';
  const labels: Record<string, string> = {
    '22_24': '22~24시',
    '24_02': '24~02시',
    '07_08': '07~08시',
    NO: '비흡연',
    E_CIG: '전자담배',
    YES: '흡연',
    NONE: '없음',
    HAS: '있음',
    QUIET: '조용한 환경',
    NORMAL: '보통',
    SNACK: '간식 정도',
    RARELY: '거의 안 함',
    SOMETIMES: '가끔',
    ALWAYS: '항상 사용',
    WEEKLY_1_2: '주 1~2회',
    WEEKLY_3_UP: '주 3회 이상',
    CLOSE: '가까운 관계',
    CASUAL: '적당한 거리',
    DISTANT: '각자 생활',
  };
  return labels[value] ?? value;
}
