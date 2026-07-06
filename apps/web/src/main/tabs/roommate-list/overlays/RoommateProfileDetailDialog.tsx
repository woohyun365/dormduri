import { BaseBottomSheet } from '@/components/BaseBottomSheet';
import { CompatibilityAxisList } from '../components/CompatibilityAxisList';
import { CompatibilityRadar } from '../components/CompatibilityRadar';
import { mapCompatibilityToChartViewModel } from '../model/compatibility/compatibilityChart.mapper';
import type { RoommateProfileDetailState } from '../hooks/useRoommateProfileDetail';
import type {
  PublicProfileActionCapabilities,
  PublicProfileFullDetail,
  PublicProfileTombstone,
  PublicTargetActionUnavailableReason,
} from '@repo/shared/profile/contract';

interface RoommateProfileDetailDialogProps {
  readonly state: RoommateProfileDetailState;
  readonly onClose: () => void;
  readonly onRetry: () => void;
  readonly onRefreshList: () => void;
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
          <FullDetailContent profile={state.profile} />
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

function FullDetailContent({ profile }: { readonly profile: PublicProfileFullDetail }) {
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
      <ActionSummary actions={profile.actions} />
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
          {buildActionCtaLabel(profile.actions)}
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

function ActionSummary({ actions }: { readonly actions: PublicProfileActionCapabilities }) {
  const label = buildActionCtaLabel(actions);
  return (
    <section className="rounded-3xl border border-[var(--knu-border)] bg-white p-4">
      <p className="text-sm font-bold text-[var(--knu-text-primary)]">다음 행동</p>
      <p className="mt-2 text-sm leading-6 text-[var(--knu-text-secondary)]">{label}</p>
      <button
        type="button"
        disabled
        className="mt-4 w-full rounded-2xl bg-[var(--knu-background-alt)] px-4 py-3 text-sm font-semibold text-[var(--knu-text-secondary)] disabled:cursor-not-allowed"
      >
        Phase 8에서 연결 예정
      </button>
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

function buildActionCtaLabel(actions: PublicProfileActionCapabilities): string {
  if (actions.canRequestMatch)
    return '매칭 요청 가능한 상대예요. 실제 요청 전송은 다음 단계에서 연결해요.';
  if (actions.canStartChat) return '대화 가능한 상대예요. 대화 시작 연결은 다음 단계에서 다뤄요.';
  const primaryReason = actions.unavailableReasons[0];
  return primaryReason
    ? actionUnavailableReasonLabel(primaryReason)
    : '현재 가능한 추가 행동이 없어요.';
}

function actionUnavailableReasonLabel(reason: PublicTargetActionUnavailableReason): string {
  const labels: Record<PublicTargetActionUnavailableReason, string> = {
    VIEWER_NOT_REGISTERED: '시즌 등록 후 요청할 수 있어요.',
    VIEWER_PROFILE_INCOMPLETE: '프로필 완성 후 요청할 수 있어요.',
    VIEWER_NOT_ASSIGNED: '건물 배정 후 요청할 수 있어요.',
    TARGET_NOT_PUBLIC: '상대가 공개 대상이 아니에요.',
    DIFFERENT_DORMITORY: '다른 건물이라 새 요청 기능이 닫혔어요.',
    VIEWER_ALREADY_MATCHED: '이미 매칭되어 새 요청 기능이 닫혔어요.',
    TARGET_ALREADY_MATCHED: '상대가 이미 매칭되어 새 요청 기능이 닫혔어요.',
    SEASON_NOT_ACTIONABLE: '시즌 정책상 새 요청 기능이 닫혔어요.',
    ROOM_SELECTION_CUTOFF: '호실 선택 마감 이후에는 요청할 수 없어요.',
    THREAD_READ_ONLY: '기존 대화가 읽기 전용 상태예요.',
    TARGET_DELETED_OR_DEIDENTIFIED: '상대 정보가 더 이상 제공되지 않아요.',
    SAFETY_OR_VISIBILITY_RESTRICTED: '안전 정책상 요청할 수 없어요.',
  };
  return labels[reason];
}
