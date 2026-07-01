'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SeasonState } from '@repo/shared/season/runtime';
import type { TabId, MatchingNavOptions } from '@/types/profile';
import type { HomeDashboardViewModel } from '../model/homeDashboardViewModel';

interface HomePrimaryStateCardProps {
  viewModel: HomeDashboardViewModel;
  seasonState: SeasonState;
  daysUntilEnd: number;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  onOpenBuildingSelect?: () => void;
}

type PrimaryTone =
  | 'blue'
  | 'green'
  | 'amber'
  | 'purple'
  | 'cyan'
  | 'openRequired'
  | 'openPrep'
  | 'slate';

interface PrimaryAction {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface PrimaryInsight {
  label: string;
  value: string;
  icon: LucideIcon;
  iconClassName: string;
}

interface PrimaryDateRow {
  label: string;
  value: string;
  badge?: string;
}

type PrimaryTaskStepStatus = 'complete' | 'actionable' | 'locked' | 'blocked';

interface PrimaryTaskStep {
  id: 'profile' | 'dormitory' | 'registration';
  label: string;
  status: PrimaryTaskStepStatus;
  statusLabel?: string;
  helper?: string;
}

interface PrimaryNotice {
  tone: 'info' | 'warning' | 'success';
  text: string;
}

interface PrimaryPolicyHint {
  label: string;
  text: string;
  icon: LucideIcon;
  iconClassName: string;
}

type SeasonOpenPolicyHintContext =
  | 'profile-and-dormitory-required'
  | 'dormitory-required'
  | 'profile-required'
  | 'registration-ready'
  | 'registered-summary';

interface PrimaryContent {
  eyebrow: string;
  title: string;
  body?: string;
  icon: React.ElementType;
  tone: PrimaryTone;
  action?: PrimaryAction;
  secondaryAction?: PrimaryAction;
  steps?: PrimaryTaskStep[];
  notice?: PrimaryNotice;
  insights?: PrimaryInsight[];
  insightTitle?: string;
  dateSectionTitle?: string;
  dateRows?: PrimaryDateRow[];
  meta?: string;
  helper?: string;
  policyHints?: PrimaryPolicyHint[];
  policyHintAriaLabel?: string;
}

const PRIMARY_HEADER_TONE = {
  surface: 'bg-linear-to-r from-blue-50 to-purple-50',
  border: 'border-blue-200',
  status: 'bg-green-500',
  icon: 'text-(--knu-primary)',
  accent: 'text-(--knu-primary)',
} satisfies {
  surface: string;
  border: string;
  status: string;
  icon: string;
  accent: string;
};

const TONE_STYLES: Record<
  PrimaryTone,
  {
    surface: string;
    border: string;
    status: string;
    icon: string;
    accent: string;
  }
> = {
  blue: PRIMARY_HEADER_TONE,
  green: {
    surface: 'bg-linear-to-r from-green-50 to-emerald-50',
    border: 'border-green-200',
    status: 'bg-green-500',
    icon: 'text-green-600',
    accent: 'text-green-700',
  },
  amber: {
    surface: 'bg-linear-to-r from-amber-50 to-yellow-50',
    border: 'border-amber-200',
    status: 'bg-amber-500',
    icon: 'text-amber-600',
    accent: 'text-amber-800',
  },
  purple: {
    surface: 'bg-linear-to-r from-purple-50 to-blue-50',
    border: 'border-purple-200',
    status: 'bg-purple-500',
    icon: 'text-purple-600',
    accent: 'text-purple-700',
  },
  cyan: {
    surface: 'bg-cyan-50',
    border: 'border-cyan-300',
    status: 'bg-cyan-600',
    icon: 'text-cyan-700',
    accent: 'text-cyan-800',
  },
  openRequired: {
    surface: 'bg-linear-to-r from-slate-50 via-sky-50 to-cyan-50',
    border: 'border-sky-200',
    status: 'bg-sky-500',
    icon: 'text-sky-600',
    accent: 'text-sky-700',
  },
  openPrep: {
    surface: 'bg-linear-to-r from-sky-50 via-cyan-50 to-blue-50',
    border: 'border-cyan-200',
    status: 'bg-cyan-500',
    icon: 'text-cyan-600',
    accent: 'text-cyan-700',
  },
  slate: {
    surface: 'bg-linear-to-r from-slate-100 via-zinc-50 to-stone-100',
    border: 'border-slate-300',
    status: 'bg-slate-500',
    icon: 'text-slate-600',
    accent: 'text-slate-700',
  },
};

const NO_NEXT_SEASON_EYEBROW_WITH_HISTORY = '시즌 매칭 종료';
const NO_NEXT_SEASON_EYEBROW_WITHOUT_HISTORY = '시즌 일정 공개 전';
const NO_NEXT_SEASON_TITLE = '다음 시즌에 만나요.';
const NO_NEXT_SEASON_BODY = '다음 시즌 일정은 학교 공식 일정에 맞춰 등록될 예정이에요.';
const POLICY_HINT_ROTATION_MS = 5000;
const POLICY_HINT_SIGNATURE_SEPARATOR = '\u001f';

const TASK_STEP_STATUS_COPY: Record<
  PrimaryTaskStepStatus,
  {
    label: string;
    className: string;
    dotClassName: string;
  }
> = {
  complete: {
    label: '완료',
    className: 'bg-green-50 text-green-700 ring-green-100',
    dotClassName: 'bg-green-500',
  },
  actionable: {
    label: '필요',
    className: 'bg-amber-50 text-amber-700 ring-amber-100',
    dotClassName: 'bg-amber-500',
  },
  locked: {
    label: '대기',
    className: 'bg-slate-50 text-slate-600 ring-slate-100',
    dotClassName: 'bg-slate-400',
  },
  blocked: {
    label: '보류',
    className: 'bg-amber-50 text-amber-700 ring-amber-100',
    dotClassName: 'bg-amber-500',
  },
};

const NOTICE_TONE_CLASS_NAME: Record<PrimaryNotice['tone'], string> = {
  info: 'border-white/70 bg-white/70 text-slate-700',
  warning: 'border-white/70 bg-white/70 text-slate-700',
  success: 'border-white/70 bg-white/70 text-slate-700',
};

const NOTICE_ICON_CLASS_NAME: Record<PrimaryNotice['tone'], string> = {
  info: 'text-blue-600',
  warning: 'text-amber-600',
  success: 'text-green-600',
};

const TASK_STEP_CARD_CLASS_NAME: Record<PrimaryTaskStepStatus, string> = {
  complete: 'border-white/75 bg-white/80 shadow-slate-200/50',
  actionable: 'border-white/75 bg-white/80 shadow-slate-200/55',
  locked: 'border-white/65 bg-white/60 shadow-slate-200/40',
  blocked: 'border-amber-200/70 bg-white/80 shadow-amber-100/40',
};

export function HomePrimaryStateCard({
  viewModel,
  seasonState,
  daysUntilEnd,
  onNavigate,
  onOpenBuildingSelect,
}: HomePrimaryStateCardProps) {
  const content = resolvePrimaryContent({
    viewModel,
    seasonState,
    daysUntilEnd,
    onNavigate,
    onOpenBuildingSelect,
  });
  const tone = TONE_STYLES[content.tone];
  const Icon = content.icon;
  const isSeasonPreparationState =
    seasonState === 'SEASON_OPEN' ||
    (seasonState === 'SEASON_MATCHING' && Boolean(content.steps?.length));
  const shouldRenderActions =
    !isSeasonPreparationState && (content.action || content.secondaryAction);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${tone.surface} border-2 ${tone.border} rounded-2xl p-4 keep-all`}
      aria-labelledby="home-primary-state-title"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className={`h-2 w-2 shrink-0 rounded-full ${tone.status}`} />
          <span className="truncate text-sm font-bold text-(--knu-text-primary)">
            {content.eyebrow}
          </span>
        </div>
        <Icon className={`h-5 w-5 shrink-0 ${tone.icon}`} aria-hidden="true" />
      </div>

      <div className="mb-3">
        {content.meta && (
          <p className={`mb-2 text-xs font-semibold ${tone.accent}`}>{content.meta}</p>
        )}
        <h2
          id="home-primary-state-title"
          className="text-xl font-extrabold leading-snug text-(--knu-text-primary)"
        >
          {content.title}
        </h2>
        {content.body && (
          <p className="mt-2 text-sm leading-relaxed text-(--knu-text-secondary)">{content.body}</p>
        )}
      </div>

      <div className="space-y-3">
        {content.steps && content.steps.length > 0 && (
          <div className="border-t border-white/40 pt-3">
            <p className={`mb-2 text-xs font-bold ${tone.accent}`}>시즌 참여 조건</p>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,0.72fr)] sm:items-stretch">
              <ol className="grid gap-2 sm:grid-cols-2" aria-label="시즌 참여 준비 조건">
                {content.steps
                  .filter((step) => step.id !== 'registration')
                  .map((step) => (
                    <TaskStepCard key={step.id} step={step} />
                  ))}
              </ol>
              <div className="flex items-center justify-center" aria-hidden="true">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/70 bg-white/75 text-slate-400 shadow-sm shadow-slate-200/50">
                  <ArrowRight className="h-3.5 w-3.5 rotate-90 sm:rotate-0" />
                </span>
              </div>
              <ol aria-label="시즌 참여 신청 상태">
                {content.steps
                  .filter((step) => step.id === 'registration')
                  .map((step) => (
                    <TaskStepCard key={step.id} step={step} emphasis />
                  ))}
              </ol>
            </div>
          </div>
        )}
        {content.insights && content.insights.length > 0 && (
          <div className="border-t border-white/40 pt-3">
            {content.insightTitle && (
              <p className={`mb-2 text-xs font-bold ${tone.accent}`}>{content.insightTitle}</p>
            )}
            <dl
              className={`grid gap-3 ${content.insights.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
            >
              {content.insights.map((insight) => {
                const InsightIcon = insight.icon;

                return (
                  <div
                    key={insight.label}
                    className="rounded-xl border border-white/70 bg-white/75 p-3 text-center shadow-sm shadow-slate-200/60 backdrop-blur-sm"
                  >
                    <dt className="flex flex-col items-center gap-1.5 text-xs text-(--knu-text-tertiary)">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full ${insight.iconClassName}`}
                      >
                        <InsightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span>{insight.label}</span>
                    </dt>
                    <dd className="mt-1 text-base font-bold text-(--knu-text-primary)">
                      {insight.value}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        )}
        {content.dateRows && content.dateRows.length > 0 && (
          <div className="space-y-2 rounded-xl border border-white/70 bg-white/70 p-3 shadow-sm shadow-slate-200/50 backdrop-blur-sm">
            {content.dateSectionTitle && (
              <p className="text-xs font-bold text-slate-700">{content.dateSectionTitle}</p>
            )}
            <div className="space-y-1.5">
              {content.dateRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-slate-700">{row.label}:</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-slate-700">{row.value}</span>
                    {row.badge && (
                      <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-bold text-white">
                        {row.badge}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {content.notice && (
          <div
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold leading-relaxed shadow-sm shadow-slate-200/40 backdrop-blur-sm ${NOTICE_TONE_CLASS_NAME[content.notice.tone]}`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/85 ${NOTICE_ICON_CLASS_NAME[content.notice.tone]}`}
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <p>{content.notice.text}</p>
          </div>
        )}
        {content.policyHints && content.policyHints.length > 0 ? (
          <PrimaryPolicyHintRotator
            hints={content.policyHints}
            ariaLabelPrefix={content.policyHintAriaLabel}
          />
        ) : (
          content.helper && (
            <div className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/65 p-3 text-xs leading-relaxed text-(--knu-text-secondary) shadow-sm shadow-slate-200/50 backdrop-blur-sm">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/80 text-(--knu-primary)">
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <p>{content.helper}</p>
            </div>
          )
        )}
        {shouldRenderActions && (
          <div className="flex flex-col sm:flex-row gap-2">
            {content.action && <ActionButton action={content.action} />}
            {content.secondaryAction && <ActionButton action={content.secondaryAction} />}
          </div>
        )}
      </div>
    </motion.section>
  );
}

function PrimaryPolicyHintRotator({
  hints,
  ariaLabelPrefix = '이용 안내',
}: {
  hints: PrimaryPolicyHint[];
  ariaLabelPrefix?: string;
}) {
  const hintsSignature = hints
    .map(
      (hint) =>
        `${hint.label}${POLICY_HINT_SIGNATURE_SEPARATOR}${hint.text}${POLICY_HINT_SIGNATURE_SEPARATOR}${hint.iconClassName}`,
    )
    .join(POLICY_HINT_SIGNATURE_SEPARATOR);
  const [rotation, setRotation] = useState({ signature: hintsSignature, index: 0 });
  const currentIndex = rotation.signature === hintsSignature ? rotation.index : 0;

  useEffect(() => {
    if (hints.length <= 1) return;

    const timer = setInterval(() => {
      setRotation((prev) => {
        const previousIndex = prev.signature === hintsSignature ? prev.index : 0;

        return {
          signature: hintsSignature,
          index: (previousIndex + 1) % hints.length,
        };
      });
    }, POLICY_HINT_ROTATION_MS);

    return () => clearInterval(timer);
  }, [hints.length, hintsSignature]);

  const currentHint = hints[currentIndex % hints.length];
  if (!currentHint) return null;

  const HintIcon = currentHint.icon;

  return (
    <div
      className="relative min-h-19 overflow-hidden rounded-xl border border-white/70 bg-white/65 shadow-sm shadow-slate-200/50 backdrop-blur-sm sm:min-h-16"
      data-testid="home-primary-policy-hint"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentIndex}-${currentHint.label}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          data-active-policy-hint-index={currentIndex % hints.length}
          className="absolute inset-0 flex items-center gap-3 p-3"
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/85 shadow-sm shadow-slate-200/50 ${currentHint.iconClassName}`}
          >
            <HintIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-slate-500">{currentHint.label}</p>
            <p className="mt-0.5 text-xs font-semibold leading-relaxed text-slate-700">
              {currentHint.text}
            </p>
          </div>
          {hints.length > 1 && (
            <div
              className="flex shrink-0 items-center gap-1"
              aria-label={`${ariaLabelPrefix} 순서`}
            >
              {hints.map((hint, index) => (
                <button
                  key={hint.label}
                  type="button"
                  onClick={() => setRotation({ signature: hintsSignature, index })}
                  className={`rounded-full transition-all ${
                    index === currentIndex % hints.length
                      ? 'h-1.5 w-4 bg-slate-600/70'
                      : 'h-1.5 w-1.5 bg-slate-300 hover:bg-slate-400'
                  }`}
                  aria-label={`${ariaLabelPrefix} ${index + 1}: ${hint.label}`}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function resolvePrimaryContent({
  viewModel,
  seasonState,
  daysUntilEnd,
  onNavigate,
  onOpenBuildingSelect,
}: HomePrimaryStateCardProps): PrimaryContent {
  const goProfile = () => onNavigate('profile');
  const goList = () => onNavigate('list');
  const goCurrentMatching = () => onNavigate('matching', { section: 'current' });
  const goPastMatching = () => onNavigate('matching', { section: 'past' });
  const goChat = () => onNavigate('chat');
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

    if (viewModel.hasActiveMatch) {
      return {
        eyebrow: '매칭 확정',
        title: '확정된 룸메 결과를 확인해요',
        body: `${viewModel.activeMatch?.partnerNickname ?? '상대'}님과 매칭이 확정되어 있어요. 호실 선택은 학교 시스템에서 진행해 주세요.`,
        icon: CheckCircle2,
        tone: 'green',
        action: { label: '매칭 현황 보기', icon: BarChart3, onClick: goCurrentMatching },
        secondaryAction: viewModel.capabilities.canStartChat
          ? { label: '채팅 보기', icon: MessageCircle, onClick: goChat, variant: 'secondary' }
          : undefined,
        insights: [
          {
            label: '상대',
            value: viewModel.activeMatch?.partnerNickname ?? '확정',
            icon: UserRound,
            iconClassName: 'bg-green-50 text-green-600',
          },
          {
            label: '상태',
            value: '매칭 확정',
            icon: CheckCircle2,
            iconClassName: 'bg-green-50 text-green-600',
          },
          {
            label: '종료',
            value: daysUntilEnd > 0 ? `D-${daysUntilEnd}` : '정리 중',
            icon: Clock3,
            iconClassName: 'bg-blue-50 text-blue-600',
          },
        ],
        helper: daysUntilEnd > 0 ? `시즌 매칭 종료까지 D-${daysUntilEnd}` : undefined,
      };
    }

    if (viewModel.matchingSummary.stats.receivedRequests > 0) {
      return {
        eyebrow: '응답 필요',
        title: '도착한 매칭 요청을 확인해요',
        body: `받은 요청 ${viewModel.matchingSummary.stats.receivedRequests}건이 있어요. 상대 프로필을 확인하고 수락 여부를 결정해보세요.`,
        icon: MessageCircle,
        tone: 'purple',
        action: { label: '받은 요청 보기', icon: BarChart3, onClick: goCurrentMatching },
        insights: buildMatchingInsights(viewModel, daysUntilEnd),
        helper: daysUntilEnd > 0 ? `매칭 종료까지 D-${daysUntilEnd}` : undefined,
      };
    }

    return {
      eyebrow: '매칭 진행 중',
      title: '같은 기숙사 룸메 후보를 찾아보세요',
      body: '생활패턴이 잘 맞는 후보를 보고 대화하거나 매칭 요청을 보낼 수 있어요.',
      icon: Search,
      tone: 'blue',
      action: { label: '룸메 찾기', icon: Search, onClick: goList },
      secondaryAction: {
        label: '매칭 현황 보기',
        icon: BarChart3,
        onClick: goCurrentMatching,
        variant: 'secondary',
      },
      insights: buildMatchingInsights(viewModel, daysUntilEnd),
      helper: daysUntilEnd > 0 ? `매칭 종료까지 D-${daysUntilEnd}` : undefined,
    };
  }

  if (seasonState === 'SEASON_POST_MATCH') {
    return {
      eyebrow: '시즌 마감 정리',
      title: viewModel.hasActiveMatch ? '확정 결과를 확인해요' : '이번 시즌 결과를 정리해요',
      body: viewModel.hasActiveMatch
        ? `${viewModel.activeMatch?.partnerNickname ?? '상대'}님과의 확정 결과를 확인할 수 있어요. 새 매칭 요청은 닫혔고, 확정된 대화는 정책이 허용하는 기간에만 이어질 수 있어요.`
        : '새 룸메 탐색과 매칭 요청은 닫혔어요. 이번 시즌 결과와 이전 시즌 기록을 확인할 수 있어요.',
      icon: History,
      tone: 'purple',
      action: { label: '시즌 결과 보기', icon: History, onClick: goPastMatching },
      secondaryAction: viewModel.capabilities.canStartChat
        ? { label: '채팅 보기', icon: MessageCircle, onClick: goChat, variant: 'secondary' }
        : undefined,
      insights: buildPostMatchInsights(viewModel),
      helper: '시즌 마감 정리 기간에는 신규 요청이 아니라 결과 확인 중심으로 이용해 주세요.',
    };
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
    dateRows: viewModel.seasonSummary.hasNextSeasonPreview
      ? buildOffSeasonDateRows(viewModel)
      : undefined,
    policyHints: buildOffSeasonPolicyHints(viewModel),
    policyHintAriaLabel: '비시즌 안내',
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
  const dateRows = buildSeasonOpenDateRows(viewModel);

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
      label: '참여 신청',
      status: registrationReady ? 'complete' : registrationActionable ? 'actionable' : 'locked',
      statusLabel: registrationReady ? '완료' : registrationActionable ? '가능' : '대기',
      helper: registrationReady
        ? '룸메 후보 보기 가능'
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

function buildSeasonOpenDateRows(viewModel: HomeDashboardViewModel): PrimaryDateRow[] | undefined {
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
      eyebrow: `${phaseLabel} · 확인 필요`,
      title: '이번 시즌 참여가 제한됐어요',
      body: '이미 참여를 철회했거나 참여하지 않기로 선택해 이번 시즌 참여 신청을 다시 진행할 수 없어요.',
      icon: ShieldAlert,
      tone: 'slate',
      steps,
      dateRows,
      notice: { tone: 'warning', text: '상태 변경이 필요하면 운영 안내를 확인해주세요.' },
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

function buildOffSeasonDateRows(viewModel: HomeDashboardViewModel): PrimaryDateRow[] {
  return [
    {
      label: '시즌 오픈',
      value: viewModel.seasonSummary.nextSeasonDate,
      badge: `D-${viewModel.seasonSummary.daysUntilNext}`,
    },
  ];
}

function buildMatchingInsights(
  viewModel: HomeDashboardViewModel,
  daysUntilEnd: number,
): PrimaryInsight[] {
  return [
    {
      label: '받은 요청',
      value: `${viewModel.matchingSummary.stats.receivedRequests}건`,
      icon: MessageCircle,
      iconClassName: 'bg-purple-50 text-purple-600',
    },
    {
      label: '보낸 요청',
      value: `${viewModel.matchingSummary.stats.sentRequests}건`,
      icon: ArrowRight,
      iconClassName: 'bg-blue-50 text-blue-600',
    },
    {
      label: '종료',
      value: daysUntilEnd > 0 ? `D-${daysUntilEnd}` : '마감 임박',
      icon: Clock3,
      iconClassName: 'bg-blue-50 text-blue-600',
    },
  ];
}

function buildPostMatchInsights(viewModel: HomeDashboardViewModel): PrimaryInsight[] {
  const lastSeason = viewModel.seasonSummary.lastSeason;

  if (!lastSeason) {
    return [
      {
        label: '새 요청',
        value: '닫힘',
        icon: Clock3,
        iconClassName: 'bg-slate-100 text-slate-600',
      },
      {
        label: '결과',
        value: viewModel.hasActiveMatch ? '확정' : '정리',
        icon: History,
        iconClassName: 'bg-purple-50 text-purple-600',
      },
      {
        label: '기록',
        value: '확인 가능',
        icon: History,
        iconClassName: 'bg-blue-50 text-blue-600',
      },
    ];
  }

  return [
    {
      label: '지난 참여',
      value: `${lastSeason.totalParticipants}명`,
      icon: UserRound,
      iconClassName: 'bg-blue-50 text-blue-600',
    },
    {
      label: '성공',
      value: `${lastSeason.aggregate.matchedPairCount}쌍`,
      icon: CheckCircle2,
      iconClassName: 'bg-green-50 text-green-600',
    },
    {
      label: '운영',
      value: `${lastSeason.aggregate.operatedDormitoryCount}곳`,
      icon: Building2,
      iconClassName: 'bg-cyan-50 text-cyan-600',
    },
  ];
}

function TaskStepCard({ step, emphasis = false }: { step: PrimaryTaskStep; emphasis?: boolean }) {
  const status = TASK_STEP_STATUS_COPY[step.status];

  return (
    <li
      className={`relative h-full overflow-hidden rounded-xl border p-3 shadow-sm backdrop-blur-sm ${TASK_STEP_CARD_CLASS_NAME[step.status]} ${
        emphasis ? 'bg-white/90 ring-1 ring-white/85' : ''
      }`}
    >
      <span
        className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${status.dotClassName}`}
        aria-hidden="true"
      />
      <div className="flex items-center justify-between gap-2 pl-1">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${status.dotClassName}`}
            aria-hidden="true"
          />
          <span className="truncate text-xs font-bold text-(--knu-text-primary)">{step.label}</span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${status.className}`}
        >
          {step.statusLabel ?? status.label}
        </span>
      </div>
      {step.helper && (
        <p className="mt-1.5 pl-1 text-[11px] leading-relaxed text-(--knu-text-tertiary)">
          {step.helper}
        </p>
      )}
    </li>
  );
}

function ActionButton({ action }: { action: PrimaryAction }) {
  const variant = action.variant ?? 'primary';
  const Icon = action.icon;
  const className =
    variant === 'primary'
      ? 'bg-white/85 hover:bg-white border border-white/80 text-(--knu-text-primary) shadow-sm shadow-slate-200/60 backdrop-blur-sm'
      : 'bg-white/55 hover:bg-white/80 text-(--knu-text-primary) border border-white/70 shadow-sm shadow-slate-200/40 backdrop-blur-sm';

  return (
    <motion.button
      type="button"
      onClick={action.onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`min-h-11 flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${className}`}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
      <span>{action.label}</span>
      {variant === 'primary' && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
    </motion.button>
  );
}
