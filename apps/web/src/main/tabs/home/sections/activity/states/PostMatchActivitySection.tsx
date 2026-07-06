import { useState } from 'react';
import { motion } from 'motion/react';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  MessageCircle,
  UserRound,
} from 'lucide-react';
import { sectionCard, sectionHeader } from '@/main/styles/home';
import { PostMatchCounterpartProfileModal } from '../dialogs/PostMatchCounterpartProfileModal';
import { PostMatchDetailModal } from '../dialogs/PostMatchDetailModal';
import type { TabId, MatchingNavOptions } from '@/types/profile';
import type { HomeDashboardViewModel } from '../../../model/homeDashboardViewModel';
import type { PostMatchDetailModalKind, StaticActivityMetric } from '../model/activityTypes';
import { resolvePostMatchActivityContent } from '../model/activityContent';

export function PostMatchActivitySection({
  viewModel,
  onNavigate,
}: {
  viewModel: HomeDashboardViewModel;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
}) {
  const content = resolvePostMatchActivityContent({ viewModel, onNavigate });
  const [detailModal, setDetailModal] = useState<PostMatchDetailModalKind | null>(null);
  const Icon = content.icon;
  const canShowDetailActions =
    content.outcome !== 'not-registered' && content.outcome !== 'matched';

  return (
    <section className={sectionCard()} aria-labelledby="home-activity-title">
      <div className={sectionHeader}>
        <div>
          <p className="mb-1 text-xs font-bold text-(--knu-primary)">{content.eyebrow}</p>
          <h2 id="home-activity-title" className="font-bold text-(--knu-text-primary)">
            {content.title}
          </h2>
        </div>
        <Icon className="h-5 w-5 text-(--knu-primary)" aria-hidden="true" />
      </div>

      {content.outcome === 'matched' ? (
        <PostMatchMatchedSummaryCard viewModel={viewModel} onNavigate={onNavigate} />
      ) : (
        content.metrics &&
        content.metrics.length > 0 && <PostMatchActivityMetricGrid metrics={content.metrics} />
      )}

      {canShowDetailActions && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <PostMatchActivityButton
            icon={BarChart3}
            label="이번 시즌 상세 보기"
            variant="primary"
            onClick={() => setDetailModal('activity')}
          />
          <PostMatchActivityButton
            icon={UserRound}
            label="이번 시즌 프로필 확인"
            variant="secondary"
            onClick={() => setDetailModal('profile')}
          />
        </div>
      )}

      <PostMatchDetailModal
        kind={detailModal}
        viewModel={viewModel}
        onClose={() => setDetailModal(null)}
      />
    </section>
  );
}
function PostMatchActivityMetricGrid({ metrics }: { metrics: StaticActivityMetric[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {metrics.map((metric) => (
        <PostMatchActivityMetricCell key={metric.label} metric={metric} />
      ))}
    </div>
  );
}

function PostMatchActivityMetricCell({ metric }: { metric: StaticActivityMetric }) {
  const MetricIcon = metric.icon;
  const tone = resolvePostMatchMetricTone(metric);
  const toneClassName = {
    purple: {
      card: 'bg-(--knu-background-alt) hover:bg-purple-50',
      icon: 'bg-purple-100 text-purple-600',
      value: 'text-purple-600',
    },
    amber: {
      card: 'bg-(--knu-background-alt) hover:bg-amber-50',
      icon: 'bg-amber-100 text-amber-600',
      value: 'text-amber-600',
    },
    teal: {
      card: 'bg-(--knu-background-alt) hover:bg-teal-50',
      icon: 'bg-teal-100 text-teal-600',
      value: 'text-teal-600',
    },
    slate: {
      card: 'bg-(--knu-background-alt) hover:bg-slate-50',
      icon: 'bg-slate-100 text-slate-600',
      value: 'text-slate-700',
    },
  }[tone];
  const content = (
    <>
      <div
        className={`mb-2 flex size-10 items-center justify-center rounded-full transition-transform group-hover:scale-110 ${toneClassName.icon}`}
      >
        <MetricIcon className="size-5" aria-hidden="true" />
      </div>
      <span className={`text-lg font-bold ${toneClassName.value}`}>{metric.value}</span>
      <span className="mt-0.5 text-xs font-medium text-(--knu-text-tertiary)">{metric.label}</span>
      <span className={`mt-0.5 text-[10px] ${toneClassName.value}`}>{metric.helper}</span>
    </>
  );
  const className = `group relative flex flex-col items-center rounded-xl p-3 text-center transition-colors ${toneClassName.card}`;

  if (metric.onClick) {
    return (
      <motion.button
        type="button"
        onClick={metric.onClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={className}
      >
        {content}
      </motion.button>
    );
  }

  return <div className={className}>{content}</div>;
}

function resolvePostMatchMetricTone(
  metric: StaticActivityMetric,
): 'purple' | 'amber' | 'teal' | 'slate' {
  if (metric.label.includes('받은')) return 'purple';
  if (metric.label.includes('보낸')) return 'amber';
  if (metric.label.includes('대화')) return 'teal';
  return 'slate';
}

function PostMatchMatchedSummaryCard({
  viewModel,
  onNavigate,
}: {
  viewModel: HomeDashboardViewModel;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
}) {
  const [isProfileOpen, setProfileOpen] = useState(false);
  const activeMatch = viewModel.matchingSummary.activeMatch;
  const nickname = activeMatch?.nickname ?? viewModel.activeMatch?.partnerNickname ?? '상대';
  const matchScore = activeMatch?.matchScore ?? viewModel.activeMatch?.matchScore ?? 0;

  return (
    <div className="rounded-3xl border border-emerald-100 bg-linear-to-br from-emerald-50 via-white to-cyan-50 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/20">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-emerald-700">현재 매칭 상대</p>
          <h3 className="mt-0.5 truncate text-xl font-extrabold text-(--knu-text-primary)">
            {nickname}
          </h3>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <PostMatchMatchedMetric
          icon={UserRound}
          label="매칭도"
          value={`${matchScore}%`}
          helper="프로필 기준"
          tone="emerald"
        />
        <PostMatchMatchedMetric
          icon={CalendarDays}
          label="시즌 종료일"
          value={viewModel.seasonEndDate || '확인 필요'}
          helper="매칭 대화 유지 기준"
          tone="cyan"
        />
        <PostMatchMatchedMetric
          icon={MessageCircle}
          label="채팅"
          value={viewModel.capabilities.canStartChat ? '가능' : '닫힘'}
          helper={viewModel.capabilities.canStartChat ? '시즌 종료 전까지' : '정책에 따라 제한'}
          tone={viewModel.capabilities.canStartChat ? 'blue' : 'slate'}
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
        >
          <UserRound className="size-4" aria-hidden="true" />
          상대 프로필 보기
        </button>
        <button
          type="button"
          onClick={() => onNavigate('chat')}
          className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm font-bold text-cyan-700 transition-colors hover:bg-cyan-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          채팅 바로가기
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      {isProfileOpen && activeMatch && (
        <PostMatchCounterpartProfileModal
          activeMatch={activeMatch}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
}

function PostMatchMatchedMetric({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  helper: string;
  tone: 'emerald' | 'cyan' | 'blue' | 'slate';
}) {
  const toneClassName = {
    emerald: 'border-emerald-100 bg-emerald-50/75 text-emerald-700',
    cyan: 'border-cyan-100 bg-cyan-50/75 text-cyan-700',
    blue: 'border-blue-100 bg-blue-50/75 text-blue-700',
    slate: 'border-slate-200 bg-white/80 text-slate-700',
  }[tone];

  return (
    <div className={`rounded-2xl border p-3 ${toneClassName}`}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="text-xs font-bold">{label}</span>
      </div>
      <p className="mt-2 text-lg font-extrabold">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium opacity-80">{helper}</p>
    </div>
  );
}

function PostMatchActivityButton({
  icon: Icon,
  label,
  onClick,
  variant,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  variant: 'primary' | 'secondary';
}) {
  const className =
    variant === 'primary'
      ? 'border-(--knu-border) bg-(--knu-background-alt) text-(--knu-text-primary) hover:bg-gray-100'
      : 'border-(--knu-border) bg-white text-(--knu-text-primary) hover:bg-(--knu-background-alt)';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </motion.button>
  );
}
