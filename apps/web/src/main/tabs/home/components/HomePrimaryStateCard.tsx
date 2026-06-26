'use client';

import { motion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  History,
  Info,
  MessageCircle,
  Search,
  ShieldAlert,
  Sparkles,
  UserRound,
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

type PrimaryTone = 'blue' | 'green' | 'amber' | 'purple' | 'slate';

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

interface PrimaryContent {
  eyebrow: string;
  title: string;
  body: string;
  icon: React.ElementType;
  tone: PrimaryTone;
  action?: PrimaryAction;
  secondaryAction?: PrimaryAction;
  insights?: PrimaryInsight[];
  insightTitle?: string;
  dateSectionTitle?: string;
  dateRows?: PrimaryDateRow[];
  meta?: string;
  helper?: string;
}

const PRIMARY_HEADER_TONE = {
  gradient: 'from-blue-50 to-purple-50',
  border: 'border-blue-200',
  status: 'bg-green-500',
  icon: 'text-(--knu-primary)',
  accent: 'text-(--knu-primary)',
} satisfies {
  gradient: string;
  border: string;
  status: string;
  icon: string;
  accent: string;
};

const TONE_STYLES: Record<
  PrimaryTone,
  {
    gradient: string;
    border: string;
    status: string;
    icon: string;
    accent: string;
  }
> = {
  blue: PRIMARY_HEADER_TONE,
  green: {
    gradient: 'from-green-50 to-emerald-50',
    border: 'border-green-200',
    status: 'bg-green-500',
    icon: 'text-green-600',
    accent: 'text-green-700',
  },
  amber: {
    gradient: 'from-amber-50 to-yellow-50',
    border: 'border-amber-200',
    status: 'bg-amber-500',
    icon: 'text-amber-600',
    accent: 'text-amber-800',
  },
  purple: {
    gradient: 'from-purple-50 to-blue-50',
    border: 'border-purple-200',
    status: 'bg-purple-500',
    icon: 'text-purple-600',
    accent: 'text-purple-700',
  },
  slate: {
    gradient: 'from-slate-100 via-zinc-50 to-stone-100',
    border: 'border-slate-300',
    status: 'bg-slate-500',
    icon: 'text-slate-600',
    accent: 'text-slate-700',
  },
};

const NO_NEXT_SEASON_TITLE = '다음 시즌에 만나요.';
const NO_NEXT_SEASON_BODY = '다음 시즌 일정은 학교 공식 일정에 맞춰 등록될 예정이에요.';

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

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-r ${tone.gradient} border-2 ${tone.border} rounded-2xl p-4 keep-all`}
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
        <p className="mt-2 text-sm leading-relaxed text-(--knu-text-secondary)">{content.body}</p>
      </div>

      <div className="space-y-3">
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
              <p className={`text-xs font-bold ${tone.accent}`}>{content.dateSectionTitle}</p>
            )}
            <div className="space-y-1.5">
              {content.dateRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
                  <span className={`font-semibold ${tone.accent}`}>{row.label}:</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`truncate ${tone.accent}`}>{row.value}</span>
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
        {content.helper && (
          <div className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/65 p-3 text-xs leading-relaxed text-(--knu-text-secondary) shadow-sm shadow-slate-200/50 backdrop-blur-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/80 text-(--knu-primary)">
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <p>{content.helper}</p>
          </div>
        )}
        {(content.action || content.secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-2">
            {content.action && <ActionButton action={content.action} />}
            {content.secondaryAction && <ActionButton action={content.secondaryAction} />}
          </div>
        )}
      </div>
    </motion.section>
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

    return {
      eyebrow: hasNextSeasonPreview
        ? '다음 시즌 예고'
        : `${viewModel.seasonSummary.pastSeasonName} 시즌 매칭 종료`,
      title: hasNextSeasonPreview ? `${nextSeasonName} 준비가 곧 시작돼요` : NO_NEXT_SEASON_TITLE,
      body: hasNextSeasonPreview ? '시즌 일정을 확인해주세요.' : NO_NEXT_SEASON_BODY,
      icon: CalendarDays,
      tone: 'slate',
      insights: buildOffSeasonInsights(viewModel),
      insightTitle: buildOffSeasonInsights(viewModel).length > 0 ? '이전 시즌 요약' : undefined,
      dateRows: hasNextSeasonPreview ? buildOffSeasonDateRows(viewModel) : undefined,
      helper: '비시즌에는 룸메 탐색과 새 매칭 요청이 열리지 않아요.',
    };
  }

  if (seasonState === 'SEASON_OPEN') {
    const needsSeasonProfile = !viewModel.preparation.hasSeasonProfile;
    const needsBuilding = !viewModel.preparation.hasBuilding;
    const action = needsSeasonProfile
      ? { label: '생활패턴 입력하기', icon: UserRound, onClick: goProfile }
      : needsBuilding && viewModel.preparation.canSelectBuilding
        ? { label: '배정 건물 입력하기', icon: Building2, onClick: openBuildingSelect }
        : { label: '시즌 프로필 확인', icon: UserRound, onClick: goProfile };

    return {
      eyebrow: '시즌 오픈',
      title: '시즌 프로필을 준비해요',
      body: '생활패턴과 건물 선택을 정리하고 시즌 등록을 마치면 같은 건물 후보 요약을 확인할 수 있어요. 새 매칭 요청은 매칭 기간에 열려요.',
      icon: Sparkles,
      tone: needsBuilding ? 'amber' : 'blue',
      action,
      insights: [
        {
          label: '준비 완료',
          value: `${viewModel.preparation.profileCompletion}%`,
          icon: CheckCircle2,
          iconClassName: 'bg-blue-50 text-blue-600',
        },
        {
          label: '건물',
          value: viewModel.preparation.hasBuilding ? '선택 완료' : '선택 필요',
          icon: Building2,
          iconClassName: 'bg-amber-50 text-amber-600',
        },
        {
          label: '매칭 시작',
          value: viewModel.preparation.seasonStartDate,
          icon: CalendarDays,
          iconClassName: 'bg-cyan-50 text-cyan-600',
        },
      ],
      meta: `준비 완료도 ${viewModel.preparation.profileCompletion}%`,
      helper: `매칭 시작 예정일은 ${viewModel.preparation.seasonStartDate}입니다. 매칭 요청은 시즌 매칭 기간에만 열려요.`,
    };
  }

  if (seasonState === 'SEASON_MATCHING') {
    if (viewModel.isUnassigned) {
      return {
        eyebrow: '건물 필요',
        title: '건물 배정 후 매칭을 시작해요',
        body: '시즌 등록과 건물 선택이 준비되어야 같은 건물 기준의 룸메 후보를 보고 매칭 요청을 보낼 수 있어요.',
        icon: Building2,
        tone: 'amber',
        action: { label: '건물 배정하기', icon: Building2, onClick: openBuildingSelect },
        insights: [
          {
            label: '건물',
            value: '미배정',
            icon: Building2,
            iconClassName: 'bg-amber-50 text-amber-600',
          },
          {
            label: '탐색',
            value: '대기',
            icon: Search,
            iconClassName: 'bg-slate-100 text-slate-600',
          },
          {
            label: '종료',
            value: daysUntilEnd > 0 ? `D-${daysUntilEnd}` : '마감 임박',
            icon: Clock3,
            iconClassName: 'bg-blue-50 text-blue-600',
          },
        ],
        helper: daysUntilEnd > 0 ? `매칭 종료까지 D-${daysUntilEnd}` : undefined,
      };
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
      title: '같은 건물 룸메 후보를 찾아보세요',
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
      : `${viewModel.seasonSummary.pastSeasonName} 시즌 매칭 종료`,
    title: viewModel.seasonSummary.hasNextSeasonPreview
      ? `${viewModel.seasonSummary.nextSeasonName} 준비를 기다려요`
      : NO_NEXT_SEASON_TITLE,
    body:
      viewModel.seasonSummary.daysUntilNext > 0
        ? `${viewModel.seasonSummary.nextSeasonName} 준비 시작까지 ${viewModel.seasonSummary.daysUntilNext}일 남았어요. 지금은 지난 시즌 기록과 내 정보를 확인할 수 있어요.`
        : NO_NEXT_SEASON_BODY,
    icon: Clock3,
    tone: 'slate',
    insights: buildOffSeasonInsights(viewModel),
    insightTitle: buildOffSeasonInsights(viewModel).length > 0 ? '이전 시즌 요약' : undefined,
    dateRows: viewModel.seasonSummary.hasNextSeasonPreview
      ? buildOffSeasonDateRows(viewModel)
      : undefined,
    helper: '비시즌에는 타인 탐색과 새 매칭 요청이 열리지 않아요.',
  };
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
