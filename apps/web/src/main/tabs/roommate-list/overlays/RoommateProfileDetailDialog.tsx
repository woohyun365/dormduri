import { useEffect, useRef, useState } from 'react';
import {
  Building,
  GraduationCap,
  IdCard,
  MapPin,
  MessageCircle,
  RefreshCw,
  Sparkles,
  User,
} from 'lucide-react';
import { getAvatarColor } from '@/utils/avatarColor';
import { BaseBottomSheet } from '@/components/BaseBottomSheet';
import { Skeleton } from '@/components/Skeleton';
import {
  formatCampusName,
  formatCollegeName,
  formatGradeLabel,
  formatKoreanAgeLabel,
} from '@/main/model/profileDisplayCopy';
import { CompatibilityAxisList } from '../components/CompatibilityAxisList';
import { CompatibilityRadar } from '../components/CompatibilityRadar';
import {
  mapCompatibilityToChartViewModel,
  type CompatibilityChartViewModel,
} from '../model/compatibility/compatibilityChart.mapper';
import { formatTargetActionUnavailableReason } from '../model/actions/roommateActionReasonCopy';
import type { RoommateProfileDetailState } from '../hooks/useRoommateProfileDetail';
import type { RoommateActionTargetSnapshot } from '../hooks/useRoommateActions';
import type { RoommatePendingMatchRequestViewModel } from '../model/search/roommateSearchViewModel';
import type {
  PublicProfileFullDetail,
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

const GENERIC_ERROR_TITLE = '서버 오류로 프로필 접근에 실패했어요.';
const GENERIC_ERROR_MESSAGE = '목록을 새로고침한 뒤 다시 열람해 주세요.';

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
            pendingMatchRequest={state.target.pendingMatchRequest ?? null}
            dormitoryLabel={state.target.dormitoryLabel ?? null}
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
    <div
      role="status"
      aria-label={`${nickname} 프로필 상세를 불러오는 중`}
      data-testid="roommate-detail-loading-skeleton"
      className="space-y-5"
    >
      <ProfileDetailHeroSkeleton />
      <ProfileDetailCompatibilitySkeleton />
      <ProfileDetailActionSkeleton />
    </div>
  );
}

function ProfileDetailHeroSkeleton() {
  return (
    <section className="overflow-hidden rounded-4xl border border-blue-100 bg-blue-50/70 p-5 shadow-sm backdrop-blur lg:p-6">
      <div className="mb-4 space-y-2">
        <Skeleton width="72px" height="12px" className="rounded-full! bg-blue-100!" />
        <Skeleton width="128px" height="20px" className="rounded-full! bg-white/80!" />
      </div>

      <div className="space-y-3">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur lg:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton width="40px" height="40px" className="shrink-0 rounded-full! bg-blue-100!" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton width="56px" height="12px" className="rounded-full!" />
              <Skeleton width="min(220px, 70%)" height="28px" className="rounded-full!" />
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {['캠퍼스', '기숙사', '나이'].map((label) => (
              <div
                key={label}
                className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2 shadow-sm"
              >
                <Skeleton width="44px" height="10px" className="mb-2 rounded-full!" />
                <Skeleton width="80%" height="16px" className="rounded-full!" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1].map((index) => (
            <div
              key={index}
              className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-sm"
            >
              <Skeleton width="96px" height="12px" className="rounded-full!" />
              <Skeleton width="72%" height="18px" className="mt-3 rounded-full!" />
            </div>
          ))}
        </div>

        <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-4 shadow-sm lg:p-5">
          <Skeleton width="72px" height="14px" className="mb-3 rounded-full!" />
          <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3">
            <Skeleton width="100%" height="14px" className="rounded-full! bg-blue-100!" />
            <Skeleton width="86%" height="14px" className="mt-2 rounded-full! bg-blue-100!" />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileDetailCompatibilitySkeleton() {
  return (
    <section className="space-y-4 rounded-3xl border border-indigo-100 bg-white p-4">
      <div className="space-y-2">
        <Skeleton width="88px" height="12px" className="rounded-full! bg-indigo-100!" />
        <Skeleton width="180px" height="20px" className="rounded-full!" />
        <div className="flex flex-wrap gap-1.5">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} width="74px" height="24px" className="rounded-full!" />
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-indigo-100 bg-indigo-50/40 p-4">
        <div className="flex items-start gap-3">
          <Skeleton width="36px" height="36px" className="shrink-0 rounded-full! bg-white!" />
          <div className="flex-1 space-y-2">
            <Skeleton width="72px" height="12px" className="rounded-full!" />
            <Skeleton width="150px" height="18px" className="rounded-full!" />
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[0, 1].map((index) => (
            <div key={index} className="rounded-2xl border border-white/80 bg-white/80 p-3">
              <Skeleton width="45%" height="12px" className="rounded-full!" />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[0, 1, 2].map((chip) => (
                  <Skeleton key={chip} width="56px" height="22px" className="rounded-full!" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-sky-100 bg-sky-50/50 p-4">
        <div className="mx-auto aspect-square max-w-[320px] rounded-full border border-sky-100 bg-white/80 p-8">
          <Skeleton width="100%" height="100%" className="rounded-full! bg-sky-100/80!" />
        </div>
      </div>

      <div className="rounded-3xl border border-sky-100 bg-sky-50/50 p-4">
        <Skeleton width="96px" height="18px" className="rounded-full!" />
        <div className="mt-4 grid gap-2">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="rounded-2xl border border-white/80 bg-white/85 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <Skeleton width="42%" height="16px" className="rounded-full!" />
                <Skeleton width="64px" height="24px" className="rounded-full!" />
              </div>
              <Skeleton width="100%" height="8px" className="mt-3 rounded-full!" />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Skeleton width="100%" height="76px" className="rounded-2xl!" />
                <Skeleton width="100%" height="76px" className="rounded-2xl!" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProfileDetailActionSkeleton() {
  return (
    <section className="rounded-3xl border border-(--knu-border) bg-white p-4">
      <Skeleton width="120px" height="16px" className="rounded-full!" />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Skeleton width="100%" height="44px" className="rounded-2xl!" />
        <Skeleton width="100%" height="44px" className="rounded-2xl!" />
      </div>
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

function ProfileHeroSection({
  profile,
  dormitoryLabel,
}: {
  readonly profile: PublicProfileFullDetail;
  readonly dormitoryLabel?: string | null;
}) {
  const academicIdentity = [
    formatCollegeName(profile.additional.college, '단과대 비공개'),
    formatGradeLabel(profile.additional.grade, '학년 비공개'),
  ].join(' · ');
  const mbti = profile.additional.mbti ?? '-';
  const avatarColor = getAvatarColor(profile.nickname);
  const dormitory = dormitoryLabel?.trim() || '-';

  return (
    <section className="overflow-hidden rounded-4xl border border-blue-100 bg-blue-50/70 p-5 shadow-sm backdrop-blur lg:p-6">
      <div className="mb-4">
        <p className="text-xs font-bold text-blue-700">상대 프로필</p>
        <h3 className="mt-1 text-base font-bold text-(--knu-text-primary)">프로필 기본 정보</h3>
      </div>

      <div className="space-y-3">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur lg:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarColor.bg} ${avatarColor.text}`}
              aria-hidden="true"
            >
              {profile.nickname.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-600">닉네임</p>
              <h2 className="mt-1 block max-w-full truncate whitespace-nowrap text-xl font-black tracking-tight text-(--knu-text-primary) sm:text-2xl lg:text-[1.7rem]">
                {profile.nickname}
              </h2>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <HeroInfoPill
              icon={<MapPin className="h-4 w-4" />}
              iconClassName="text-sky-500"
              label="캠퍼스"
              value={formatCampusName(profile.campus)}
            />
            <HeroInfoPill
              icon={<Building className="h-4 w-4" />}
              iconClassName="text-indigo-500"
              label="기숙사"
              value={dormitory}
            />
            <HeroInfoPill
              icon={<User className="h-4 w-4" />}
              iconClassName="text-orange-500"
              label="나이"
              value={formatKoreanAgeLabel(profile.additional.birthYear)}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <HeroSummaryBlock
            icon={<GraduationCap className="h-4 w-4" />}
            iconClassName="text-emerald-500"
            title="단과대 / 학년"
            value={academicIdentity}
          />
          <HeroSummaryBlock
            icon={<IdCard className="h-4 w-4" />}
            iconClassName="text-violet-500"
            title="MBTI"
            value={mbti}
          />
        </div>

        <ExpandableIntroBlock intro={profile.intro} />
      </div>
    </section>
  );
}

function HeroInfoPill({
  icon,
  iconClassName,
  label,
  value,
}: {
  readonly icon: React.ReactNode;
  readonly iconClassName: string;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/75 px-3 py-2 shadow-sm backdrop-blur">
      <span className={iconClassName} aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-(--knu-text-tertiary)">{label}</p>
        <p className="truncate text-sm font-bold text-(--knu-text-primary)">{value}</p>
      </div>
    </div>
  );
}

function HeroSummaryBlock({
  icon,
  iconClassName,
  title,
  value,
}: {
  readonly icon: React.ReactNode;
  readonly iconClassName: string;
  readonly title: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 text-slate-600">
        <span className={iconClassName} aria-hidden="true">
          {icon}
        </span>
        <p className="text-xs font-bold">{title}</p>
      </div>
      <p className="mt-2 text-sm font-bold text-(--knu-text-primary)">{value}</p>
    </div>
  );
}

const INTRO_PREVIEW_LINE_COUNT = 2;

function ExpandableIntroBlock({ intro }: { readonly intro: string }) {
  const [expandedIntro, setExpandedIntro] = useState<string | null>(null);
  const trimmedIntro = intro.trim();
  const introVisible = trimmedIntro.length > 0;
  const displayIntro = introVisible ? trimmedIntro : '-';
  const { measureRef, canExpand } = useRenderedLineOverflow({
    enabled: introVisible,
    lineCount: INTRO_PREVIEW_LINE_COUNT,
    text: displayIntro,
  });
  const expanded = expandedIntro === displayIntro;
  const introId = 'roommate-detail-intro';

  return (
    <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur lg:p-5">
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-blue-500" aria-hidden />
        <p className="text-xs font-bold text-slate-700">자기소개</p>
      </div>
      <div
        className={`rounded-2xl border px-4 py-3 ${
          introVisible ? 'border-blue-100 bg-blue-50/80' : 'border-slate-100 bg-slate-50'
        }`}
      >
        <div className="relative">
          <p
            ref={measureRef}
            aria-hidden="true"
            className={`invisible pointer-events-none absolute inset-x-0 top-0 -z-10 text-[13px] font-semibold leading-7 whitespace-normal sm:text-sm ${
              introVisible ? 'text-blue-950' : 'text-slate-500'
            }`}
          >
            {displayIntro}
          </p>
          <p
            id={introId}
            className={`text-[13px] font-semibold leading-7 sm:text-sm ${
              introVisible ? 'text-blue-950' : 'text-slate-500'
            } ${canExpand && !expanded ? 'line-clamp-2' : ''}`}
          >
            {displayIntro}
          </p>
          {canExpand && !expanded ? (
            <span
              className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-linear-to-t from-blue-50 via-blue-50/80 to-transparent"
              aria-hidden="true"
            />
          ) : null}
        </div>

        {canExpand ? (
          <button
            type="button"
            aria-controls={introId}
            aria-expanded={expanded}
            onClick={() =>
              setExpandedIntro((current) => (current === displayIntro ? null : displayIntro))
            }
            className="mt-3 inline-flex items-center rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:border-blue-200 hover:bg-blue-50"
          >
            {expanded ? '자기소개 접기' : '자기소개 더 보기'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function useRenderedLineOverflow({
  enabled,
  lineCount,
  text,
}: {
  readonly enabled: boolean;
  readonly lineCount: number;
  readonly text: string;
}) {
  const measureRef = useRef<HTMLParagraphElement>(null);
  const [measuredCanExpand, setMeasuredCanExpand] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const element = measureRef.current;
    if (!element) return;

    const measure = () => {
      const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight);
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
        setMeasuredCanExpand(false);
        return;
      }

      setMeasuredCanExpand(element.scrollHeight > lineHeight * lineCount + 1);
    };

    const frameId = window.requestAnimationFrame(measure);

    if (typeof window.ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => {
        window.cancelAnimationFrame(frameId);
        window.removeEventListener('resize', measure);
      };
    }

    const resizeObserver = new window.ResizeObserver(measure);
    resizeObserver.observe(element);
    if (element.parentElement) resizeObserver.observe(element.parentElement);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, [enabled, lineCount, text]);

  return { measureRef, canExpand: enabled && measuredCanExpand };
}

const INSIGHT_TONE_CLASS: Record<
  CompatibilityChartViewModel['dimensions'][number]['bucketTone'],
  string
> = {
  high: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  medium: 'border-blue-100 bg-blue-50 text-blue-700',
  low: 'border-slate-200 bg-slate-50 text-slate-700',
  unknown: 'border-slate-200 bg-slate-50 text-slate-600',
};

function CompatibilityInsightBadges({
  viewModel,
}: {
  readonly viewModel: CompatibilityChartViewModel;
}) {
  const alignedOrAdjustablePoints = viewModel.dimensions.filter(
    (dimension) => dimension.bucketTone === 'high' || dimension.bucketTone === 'medium',
  );
  const mismatchPoints = viewModel.dimensions.filter((dimension) => dimension.bucketTone === 'low');

  return (
    <section
      aria-labelledby="roommate-compatibility-insight-heading"
      className="rounded-3xl border border-indigo-100 bg-indigo-50/40 p-4"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-indigo-500 shadow-sm"
          aria-hidden="true"
        >
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-bold text-indigo-700">핵심 포인트</p>
          <h3
            id="roommate-compatibility-insight-heading"
            className="mt-1 text-sm font-bold text-(--knu-text-primary)"
          >
            먼저 확인하면 좋은 포인트
          </h3>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <CompatibilityInsightGroup
          title="잘 맞는 부분 / 대화로 맞출 부분"
          emptyCopy="잘 맞는 부분이 뚜렷하지 않아요."
          axes={alignedOrAdjustablePoints}
        />
        <CompatibilityInsightGroup
          title="잘 안 맞는 부분"
          emptyCopy="크게 어긋나는 부분은 많지 않아요."
          axes={mismatchPoints}
        />
      </div>
    </section>
  );
}

function CompatibilityInsightGroup({
  title,
  emptyCopy,
  axes,
}: {
  readonly title: string;
  readonly emptyCopy: string;
  readonly axes: readonly CompatibilityChartViewModel['dimensions'][number][];
}) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/80 p-3">
      <p className="text-xs font-bold text-(--knu-text-secondary)">{title}</p>
      {axes.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {axes.map((axis) => (
            <span
              key={`${title}-${axis.id}`}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                INSIGHT_TONE_CLASS[axis.bucketTone]
              }`}
            >
              {axis.label}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs leading-5 text-(--knu-text-secondary)">{emptyCopy}</p>
      )}
    </div>
  );
}

function CompatibilityLegend() {
  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
      <p className="text-[11px] font-bold text-(--knu-text-tertiary)">색상별 의미: </p>
      <ul className="flex flex-wrap gap-1.5" aria-label="적합도 색상 안내">
        <CompatibilityLegendItem className="bg-emerald-500" label="잘 맞음" />
        <CompatibilityLegendItem className="bg-blue-500" label="조율 가능" />
        <CompatibilityLegendItem className="bg-slate-400" label="서로 다름" />
      </ul>
    </div>
  );
}

function CompatibilityLegendItem({
  className,
  label,
}: {
  readonly className: string;
  readonly label: string;
}) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm">
      <span className={`h-2 w-2 rounded-full ${className}`} aria-hidden="true" />
      {label}
    </li>
  );
}

function FullDetailContent({
  profile,
  pendingMatchRequest,
  dormitoryLabel,
  actionPendingTargetIds,
  onRequestMatch,
  onBlock,
  onReport,
  onStartChat,
  onOpenMatchingRequests,
}: {
  readonly profile: PublicProfileFullDetail;
  readonly pendingMatchRequest: RoommatePendingMatchRequestViewModel | null;
  readonly dormitoryLabel: string | null;
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

  return (
    <div className="space-y-5">
      <ProfileHeroSection profile={profile} dormitoryLabel={dormitoryLabel} />

      {compatibility ? (
        <section className="space-y-4 rounded-3xl border border-indigo-100 bg-white p-4">
          <div>
            <p className="text-xs font-bold text-indigo-700">생활패턴 비교</p>
            <h3 className="mt-1 text-base font-bold text-(--knu-text-primary)">
              생활패턴 적합도 분석 결과
            </h3>
            <CompatibilityLegend />
          </div>
          <CompatibilityInsightBadges viewModel={compatibility} />
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
  const actionNotice = pendingMatchRequest?.description ?? null;
  const primaryUnavailableReason = target.actions.unavailableReasons[0] ?? null;
  const directionLimitReached = target.actions.unavailableReasons.includes(
    'MATCH_REQUEST_DIRECTION_LIMIT_REACHED',
  );

  return (
    <section className="rounded-3xl border border-(--knu-border) bg-white p-4">
      {actionNotice ? (
        <p className="text-sm leading-6 text-(--knu-text-secondary)">{actionNotice}</p>
      ) : null}
      <div className={`grid gap-2 ${actionNotice ? 'mt-4' : ''}`}>
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
