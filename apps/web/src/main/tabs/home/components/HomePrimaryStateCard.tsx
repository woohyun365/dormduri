'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  History,
  Info,
  Megaphone,
  MessageCircle,
  Search,
  ShieldAlert,
  UserRound,
  UserRoundCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Z_INDEX } from '@/constants/ui';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import type { SeasonState } from '@repo/shared/season/runtime';
import type { TabId, MatchingNavOptions } from '@/types/profile';
import type { HomeDashboardViewModel } from '../model/homeDashboardViewModel';

interface HomePrimaryStateCardProps {
  viewModel: HomeDashboardViewModel;
  seasonState: SeasonState;
  daysUntilEnd: number;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  onOpenBuildingSelect?: () => void;
  onDeregisterSeasonParticipation?: () => Promise<void>;
}

type PrimaryTone =
  | 'blue'
  | 'green'
  | 'amber'
  | 'purple'
  | 'cyan'
  | 'red'
  | 'openRequired'
  | 'openPrep'
  | 'slate';

interface PrimaryAction {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'warning';
}

interface PrimaryInsight {
  label: string;
  value: string;
  icon: LucideIcon;
  iconClassName: string;
  tone?:
    | 'neutral'
    | 'participant'
    | 'buildingOpen'
    | 'buildingLocked'
    | 'matchSuccess'
    | 'matchedResult';
  helper?: string;
  todayNewCount?: number;
  onClick?: () => void;
}

interface PrimaryDateRow {
  label: string;
  value: string;
  strongValue?: string;
  badge?: string;
  pill?: string;
  tone?: PrimaryDeadlineTone;
  hideValueOnNarrow?: boolean;
  hidePillOnNarrow?: boolean;
  hideBadgeOnNarrow?: boolean;
}

interface PrimaryProgress {
  label: string;
  value: string;
  percent: number;
  tone?: PrimaryDeadlineTone;
}

type PrimaryDeadlineTone = 'normal' | 'warning' | 'critical' | 'closed';

interface PrimarySuccessHighlight {
  count: number;
  text: string;
  urgency: 'normal' | 'warning' | 'critical';
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
  insightSubtitle?: string;
  dateSectionTitle?: string;
  dateRows?: PrimaryDateRow[];
  progress?: PrimaryProgress;
  successHighlight?: PrimarySuccessHighlight;
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
  red: {
    surface: 'bg-linear-to-r from-red-50 to-orange-50',
    border: 'border-red-200',
    status: 'bg-red-500',
    icon: 'text-red-600',
    accent: 'text-red-700',
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

const DEADLINE_TONE_STYLES: Record<
  PrimaryDeadlineTone,
  {
    fill: string;
    text: string;
    badge: string;
    panel: string;
  }
> = {
  normal: {
    fill: 'bg-blue-500',
    text: 'text-blue-700',
    badge: 'bg-blue-500',
    panel: 'border-blue-100 bg-blue-50/55',
  },
  warning: {
    fill: 'bg-amber-500',
    text: 'text-amber-700',
    badge: 'bg-amber-500',
    panel: 'border-amber-100 bg-amber-50/55',
  },
  critical: {
    fill: 'bg-red-500',
    text: 'text-red-700',
    badge: 'bg-red-500',
    panel: 'border-red-100 bg-red-50/55',
  },
  closed: {
    fill: 'bg-slate-500',
    text: 'text-slate-700',
    badge: 'bg-slate-500',
    panel: 'border-slate-200 bg-slate-50/80',
  },
};

const PRIMARY_INSIGHT_TONE_CLASS_NAMES: Record<
  NonNullable<PrimaryInsight['tone']>,
  { cell: string; icon: string; value: string }
> = {
  neutral: {
    cell: 'backdrop-blur-md rounded-xl border border-slate-200 bg-slate-50/85 p-3 shadow-sm',
    icon: 'text-slate-500',
    value: 'text-slate-800',
  },
  participant: {
    cell: 'backdrop-blur-md rounded-xl border border-cyan-200 bg-cyan-50/90 p-3 shadow-sm',
    icon: 'text-cyan-600',
    value: 'text-cyan-900',
  },
  buildingOpen: {
    cell: 'backdrop-blur-md rounded-xl border border-blue-200/70 bg-blue-50/80 p-3 shadow-sm',
    icon: 'text-blue-600',
    value: 'text-blue-900',
  },
  buildingLocked: {
    cell: 'backdrop-blur-md rounded-xl border border-blue-200/70 bg-blue-50/80 p-3 shadow-sm',
    icon: 'text-blue-600',
    value: 'text-blue-900',
  },
  matchSuccess: {
    cell: 'backdrop-blur-md rounded-xl border border-indigo-200 bg-indigo-50/85 p-3 shadow-sm',
    icon: 'text-indigo-600',
    value: 'text-indigo-900',
  },
  matchedResult: {
    cell: 'backdrop-blur-md rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 shadow-sm',
    icon: 'text-emerald-600',
    value: 'text-emerald-900',
  },
};

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
  onDeregisterSeasonParticipation,
}: HomePrimaryStateCardProps) {
  const [isWithdrawalSheetOpen, setWithdrawalSheetOpen] = useState(false);
  const content = resolvePrimaryContent({
    viewModel,
    seasonState,
    daysUntilEnd,
    onNavigate,
    onOpenBuildingSelect,
    onOpenWithdrawalSheet: () => setWithdrawalSheetOpen(true),
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
        {content.progress && <PrimaryProgressBar progress={content.progress} />}
        {content.progress && content.dateRows && content.dateRows.length > 0 && (
          <PrimaryDateRows title={content.dateSectionTitle} rows={content.dateRows} />
        )}
        {content.insights && content.insights.length > 0 && (
          <div className="border-t border-white/40 pt-3">
            {content.insightTitle && (
              <div className="mb-2">
                <p className={`text-xs font-bold ${tone.accent}`}>{content.insightTitle}</p>
                {content.insightSubtitle && (
                  <p className="mt-1 text-xs leading-relaxed text-(--knu-text-tertiary)">
                    {content.insightSubtitle}
                  </p>
                )}
              </div>
            )}
            <div
              className={`grid gap-3 ${content.insights.length === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}
            >
              {content.insights.map((insight) => {
                const InsightIcon = insight.icon;
                const compactTone = insight.tone
                  ? PRIMARY_INSIGHT_TONE_CLASS_NAMES[insight.tone]
                  : null;
                const compactBody = compactTone ? (
                  <>
                    <div className="mb-1 flex items-center gap-1.5">
                      <InsightIcon className={`size-3.5 ${compactTone.icon}`} aria-hidden="true" />
                      <p className="text-[11px] font-bold text-(--knu-text-tertiary)">
                        {insight.label}
                      </p>
                    </div>
                    <p
                      className={`flex items-baseline gap-1 text-sm font-extrabold ${compactTone.value}`}
                    >
                      <span>{insight.value}</span>
                      {insight.todayNewCount !== undefined && insight.todayNewCount > 0 && (
                        <motion.span
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="text-xs font-bold text-green-600"
                        >
                          (+{insight.todayNewCount}명)
                        </motion.span>
                      )}
                    </p>
                    {insight.helper && (
                      <p className="mt-0.5 text-[11px] text-(--knu-text-tertiary)">
                        {insight.helper}
                      </p>
                    )}
                  </>
                ) : null;
                const centeredBody = (
                  <>
                    <span className="flex flex-col items-center gap-1.5 text-xs text-(--knu-text-tertiary)">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full ${insight.iconClassName}`}
                      >
                        <InsightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span>{insight.label}</span>
                    </span>
                    <span className="mt-1 block text-base font-bold text-(--knu-text-primary)">
                      <span>{insight.value}</span>
                      {insight.todayNewCount !== undefined && insight.todayNewCount > 0 && (
                        <motion.span
                          animate={{ scale: [1, 1.12, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="ml-1 inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-[11px] font-extrabold text-green-600 ring-1 ring-green-100"
                        >
                          (+{insight.todayNewCount}명)
                        </motion.span>
                      )}
                    </span>
                    {insight.helper && (
                      <p className="mt-0.5 text-[11px] text-(--knu-text-tertiary)">
                        {insight.helper}
                      </p>
                    )}
                  </>
                );
                const metricBody = compactBody ?? centeredBody;
                const metricClassName = compactTone
                  ? compactTone.cell
                  : 'rounded-xl border border-white/70 bg-white/75 p-3 text-center shadow-sm shadow-slate-200/60 backdrop-blur-sm transition-colors';

                return (
                  <div key={insight.label} className={metricClassName}>
                    {metricBody}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!content.progress && content.dateRows && content.dateRows.length > 0 && (
          <PrimaryDateRows title={content.dateSectionTitle} rows={content.dateRows} />
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
        {content.successHighlight && (
          <PrimarySuccessHighlightText highlight={content.successHighlight} />
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
      {isWithdrawalSheetOpen && (
        <PrimaryWithdrawalSheet
          onDeregisterSeasonParticipation={onDeregisterSeasonParticipation}
          onClose={() => setWithdrawalSheetOpen(false)}
        />
      )}
    </motion.section>
  );
}

function PrimaryProgressBar({ progress }: { progress: PrimaryProgress }) {
  const progressTone = DEADLINE_TONE_STYLES[progress.tone ?? 'normal'];

  return (
    <div
      className={`rounded-xl border p-3 shadow-sm shadow-slate-200/50 backdrop-blur-sm ${DEADLINE_TONE_STYLES.normal.panel}`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-xs text-(--knu-text-tertiary)">{progress.label}</span>
        <span className={`text-xs font-bold ${progressTone.text}`}>{progress.value}</span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-white shadow-inner ring-1 ring-blue-100/80">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${progressTone.fill}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress.percent}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function PrimaryDateRows({ title, rows }: { title?: string; rows: PrimaryDateRow[] }) {
  const sectionTone = rows.find((row) => row.tone)?.tone;
  const sectionClassName = sectionTone
    ? DEADLINE_TONE_STYLES[sectionTone].panel
    : 'border-white/70 bg-white/70';

  return (
    <div
      className={`space-y-2 rounded-xl border p-3 shadow-sm shadow-slate-200/50 backdrop-blur-sm ${sectionClassName}`}
    >
      {title && <p className="text-xs font-bold text-slate-700">{title}</p>}
      <div className="space-y-1.5">
        {rows.map((row) => {
          const rowTone = row.tone ? DEADLINE_TONE_STYLES[row.tone] : null;

          return (
            <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
              <span className={`font-semibold ${rowTone?.text ?? 'text-slate-700'}`}>
                {row.label}:
              </span>
              <div className="flex min-w-0 items-center gap-2">
                {row.pill && (
                  <span
                    className={`${row.hidePillOnNarrow ? 'hidden min-[360px]:inline-flex' : 'inline-flex'} shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold ring-1 ring-white/80 ${rowTone?.text ?? 'text-slate-700'}`}
                  >
                    {row.pill}
                  </span>
                )}
                <span
                  className={`${row.hideValueOnNarrow ? 'hidden min-[360px]:inline' : 'inline'} truncate ${rowTone?.text ?? 'text-slate-700'}`}
                >
                  {row.value}
                </span>
                {row.strongValue && (
                  <strong
                    className={`shrink-0 font-extrabold ${rowTone?.text ?? 'text-slate-800'}`}
                  >
                    {row.strongValue}
                  </strong>
                )}
                {row.badge && (
                  <span
                    className={`${row.hideBadgeOnNarrow ? 'hidden min-[360px]:inline-flex' : 'inline-flex'} rounded-full px-2 py-0.5 text-xs font-bold text-white ${rowTone?.badge ?? 'bg-blue-500'}`}
                  >
                    {row.badge}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PrimarySuccessHighlightText({ highlight }: { highlight: PrimarySuccessHighlight }) {
  const tone =
    highlight.urgency === 'critical'
      ? {
          text: 'text-rose-900',
          number: 'text-rose-600',
          colors: ['#e11d48', '#9f1239', '#e11d48'],
        }
      : highlight.urgency === 'warning'
        ? {
            text: 'text-amber-950',
            number: 'text-amber-700',
            colors: ['#b45309', '#92400e', '#b45309'],
          }
        : {
            text: 'text-indigo-900/80',
            number: 'text-purple-600',
            colors: ['#9333ea', '#6b21a8', '#9333ea'],
          };

  return (
    <motion.p
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0, scale: [1, 1.012, 1] }}
      transition={{
        opacity: { duration: 0.35 },
        y: { duration: 0.35 },
        scale: { duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 },
      }}
      className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${tone.text}`}
    >
      <Megaphone className="mr-1 inline-block h-3.5 w-3.5 align-text-bottom" />
      {highlight.text}{' '}
      <motion.span
        animate={{ color: tone.colors }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        className={`text-base font-extrabold ${tone.number}`}
      >
        {highlight.count}명
      </motion.span>
      이 룸메 매칭을 확정했어요.
    </motion.p>
  );
}

function PrimaryWithdrawalSheet({
  onDeregisterSeasonParticipation,
  onClose,
}: {
  onDeregisterSeasonParticipation?: () => Promise<void>;
  onClose: () => void;
}) {
  const [isSubmitting, setSubmitting] = useState(false);
  const canSubmit = Boolean(onDeregisterSeasonParticipation);
  const containerRef = useFocusTrap(true, onClose);

  useBodyScrollLock(true);

  const handleDeregister = async () => {
    if (!onDeregisterSeasonParticipation) return;

    setSubmitting(true);
    let shouldClose = false;
    try {
      await onDeregisterSeasonParticipation();
      shouldClose = true;
    } catch {
      // Parent action owns the user-facing error toast; keep the sheet open for retry.
    } finally {
      setSubmitting(false);
    }

    if (shouldClose) onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-end justify-center overflow-hidden overscroll-none bg-slate-950/40 px-0 pb-0 pt-4 sm:px-4 sm:pb-4 md:items-center md:py-4"
      style={{ zIndex: Z_INDEX.bottomSheet }}
    >
      <button
        type="button"
        aria-label="시즌 참여 철회 닫기"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="시즌 참여 철회"
        tabIndex={-1}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative flex h-[min(560px,calc(100dvh-1rem))] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-black/5 sm:h-auto sm:max-h-[min(620px,calc(100dvh-2rem))] sm:rounded-3xl"
      >
        <div className="flex items-start gap-3 border-b border-(--knu-border) px-5 py-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
            <XCircle className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-amber-700">시즌 참여</p>
            <h3 className="mt-0.5 text-lg font-extrabold text-(--knu-text-primary)">
              시즌 참여 철회
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-(--knu-text-secondary)">
              철회 전 이번 시즌 참여 상태와 매칭 활동에 미치는 영향을 확인해주세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="시즌 참여 철회 닫기"
            className="rounded-full p-2 text-(--knu-text-tertiary) transition-colors hover:bg-gray-100 hover:text-(--knu-text-primary)"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
            철회하면 이번 시즌 참여자 풀에서 빠지고 같은 시즌에는 다시 참여할 수 없어요.
          </div>
          <dl className="space-y-2">
            <DetailRow label="현재 상태" value="시즌 참여 완료" />
            <DetailRow label="적용 시즌" value="현재 시즌" />
            <DetailRow label="재참여" value="같은 시즌 재참여 불가" />
          </dl>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-(--knu-text-secondary)">
            진행 중인 요청과 비매칭 대화는 철회 상태로 정리돼요. 이미 확정된 매칭이 있으면 사용자가
            직접 철회할 수 없고 별도 안내가 필요해요.
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-(--knu-border) bg-white px-5 py-4 sm:flex-row">
          <button
            type="button"
            onClick={handleDeregister}
            disabled={!canSubmit || isSubmitting}
            className="min-h-11 flex-1 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? '처리 중...' : '시즌 참여 철회하기'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-xl bg-(--knu-primary) px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-(--knu-primary-dark)"
          >
            닫기
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <dt className="text-xs font-bold text-(--knu-text-tertiary)">{label}</dt>
      <dd className="text-right text-sm font-bold text-(--knu-text-primary)">{value}</dd>
    </div>
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
  onOpenWithdrawalSheet,
}: Omit<HomePrimaryStateCardProps, 'onDeregisterSeasonParticipation'> & {
  onOpenWithdrawalSheet?: () => void;
}): PrimaryContent {
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
      : variant === 'warning'
        ? 'bg-amber-50/80 hover:bg-amber-100 text-amber-900 border border-amber-200 shadow-sm shadow-amber-100/50 backdrop-blur-sm'
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
