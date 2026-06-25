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
  MessageCircle,
  Search,
  ShieldAlert,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type { SeasonState } from '@/types/season';
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

interface PrimaryContent {
  eyebrow: string;
  title: string;
  body: string;
  icon: React.ElementType;
  tone: PrimaryTone;
  action: PrimaryAction;
  secondaryAction?: PrimaryAction;
  meta?: string;
  helper?: string;
}

const TONE_STYLES: Record<
  PrimaryTone,
  {
    shell: string;
    badge: string;
    icon: string;
    accent: string;
  }
> = {
  blue: {
    shell: 'from-blue-50 to-cyan-50 border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    icon: 'bg-blue-100 text-blue-600',
    accent: 'text-blue-700',
  },
  green: {
    shell: 'from-green-50 to-emerald-50 border-green-200',
    badge: 'bg-green-100 text-green-700',
    icon: 'bg-green-100 text-green-600',
    accent: 'text-green-700',
  },
  amber: {
    shell: 'from-amber-50 to-yellow-50 border-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    icon: 'bg-amber-100 text-amber-600',
    accent: 'text-amber-800',
  },
  purple: {
    shell: 'from-purple-50 to-blue-50 border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
    icon: 'bg-purple-100 text-purple-600',
    accent: 'text-purple-700',
  },
  slate: {
    shell: 'from-slate-50 to-blue-50 border-slate-200',
    badge: 'bg-slate-100 text-slate-700',
    icon: 'bg-slate-100 text-slate-600',
    accent: 'text-slate-700',
  },
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

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border-2 border-(--knu-border) keep-all overflow-hidden"
      aria-labelledby="home-primary-state-title"
    >
      <div className={`bg-linear-to-br ${tone.shell} border-b border-white/70 p-5`}>
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl ${tone.icon} flex items-center justify-center shrink-0`}
          >
            <Icon className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tone.badge}`}>
                {content.eyebrow}
              </span>
              {content.meta && (
                <span className={`text-xs font-semibold ${tone.accent}`}>{content.meta}</span>
              )}
            </div>
            <h2
              id="home-primary-state-title"
              className="text-xl font-extrabold leading-snug text-(--knu-text-primary)"
            >
              {content.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-(--knu-text-secondary)">
              {content.body}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-3">
        {content.helper && (
          <p className="text-xs leading-relaxed text-(--knu-text-tertiary)">{content.helper}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <ActionButton action={content.action} />
          {content.secondaryAction && <ActionButton action={content.secondaryAction} />}
        </div>
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
    };
  }

  if (!viewModel.hasCurrentSeason) {
    return {
      eyebrow: '시즌 대기',
      title: '현재 진행 중인 시즌이 없어요',
      body: '새 시즌 일정이 열리면 프로필 준비, 건물 선택, 매칭 활동을 이 화면에서 순서대로 안내할게요.',
      icon: CalendarDays,
      tone: 'slate',
      action: { label: '내 프로필 확인', icon: UserRound, onClick: goProfile },
      helper: '비시즌에는 타인 탐색과 새 매칭 요청이 열리지 않아요.',
    };
  }

  if (seasonState === 'SEASON_OPEN') {
    const needsSeasonProfile = !viewModel.preparation.hasSeasonProfile;
    const needsBuilding = !viewModel.preparation.hasBuilding;
    const action = needsSeasonProfile
      ? { label: '생활패턴 입력하기', icon: UserRound, onClick: goProfile }
      : needsBuilding && viewModel.preparation.canSelectBuilding
        ? { label: '배정 건물 입력하기', icon: Building2, onClick: openBuildingSelect }
        : { label: '내 프로필 정비하기', icon: UserRound, onClick: goProfile };

    return {
      eyebrow: '시즌 오픈',
      title: '시즌 프로필을 준비해요',
      body: '생활패턴과 건물 선택을 정리하고 시즌 등록을 마치면 매칭 기간에 같은 건물 후보와 더 정확히 연결될 수 있어요.',
      icon: Sparkles,
      tone: needsBuilding ? 'amber' : 'blue',
      action,
      meta: `준비 완료도 ${viewModel.preparation.profileCompletion}%`,
      helper: `매칭 시작 예정일은 ${viewModel.preparation.seasonStartDate}입니다. 매칭 요청은 시즌 매칭 기간에만 열려요.`,
    };
  }

  if (seasonState === 'SEASON_MATCHING') {
    if (viewModel.isUnassigned) {
      return {
        eyebrow: '건물 필요',
        title: '건물 배정 후 매칭을 시작해요',
        body: '건물을 선택해야 같은 건물 기준의 룸메 후보를 보고 매칭 요청을 보낼 수 있어요.',
        icon: Building2,
        tone: 'amber',
        action: { label: '건물 배정하기', icon: Building2, onClick: openBuildingSelect },
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
      helper: daysUntilEnd > 0 ? `매칭 종료까지 D-${daysUntilEnd}` : undefined,
    };
  }

  if (seasonState === 'SEASON_POST_MATCH') {
    return {
      eyebrow: '시즌 마감 정리',
      title: viewModel.hasActiveMatch ? '확정 결과를 확인해요' : '이번 시즌 결과를 정리해요',
      body: viewModel.hasActiveMatch
        ? `${viewModel.activeMatch?.partnerNickname ?? '상대'}님과의 확정 결과를 확인할 수 있어요. 새 매칭 요청은 닫혔고, 확정된 대화는 정책이 허용하는 기간에만 이어질 수 있어요.`
        : '새 룸메 탐색과 매칭 요청은 닫혔어요. 이번 시즌 기록과 이전 시즌 결과를 확인할 수 있어요.',
      icon: History,
      tone: 'purple',
      action: { label: '시즌 결과 보기', icon: History, onClick: goPastMatching },
      secondaryAction: viewModel.capabilities.canStartChat
        ? { label: '채팅 보기', icon: MessageCircle, onClick: goChat, variant: 'secondary' }
        : undefined,
      helper: '시즌 마감 정리 기간에는 신규 요청이 아니라 결과 확인 중심으로 이용해 주세요.',
    };
  }

  return {
    eyebrow: '비시즌',
    title: '다음 시즌을 미리 준비해요',
    body:
      viewModel.seasonSummary.daysUntilNext > 0
        ? `${viewModel.seasonSummary.nextSeasonName} 오픈까지 ${viewModel.seasonSummary.daysUntilNext}일 남았어요. 프로필을 정비하고 이전 시즌 기록을 확인해보세요.`
        : '새 시즌 일정이 확정되기 전까지는 프로필 정비와 이전 시즌 기록 확인 중심으로 이용할 수 있어요.',
    icon: Clock3,
    tone: 'blue',
    action: viewModel.capabilities.canViewMatchHistory
      ? { label: '이전 기록 보기', icon: History, onClick: goPastMatching }
      : { label: '내 프로필 확인', icon: UserRound, onClick: goProfile },
    secondaryAction: {
      label: '내 프로필 정비',
      icon: UserRound,
      onClick: goProfile,
      variant: 'secondary',
    },
    helper: '비시즌에는 타인 탐색과 새 매칭 요청이 열리지 않아요.',
  };
}

function ActionButton({ action }: { action: PrimaryAction }) {
  const variant = action.variant ?? 'primary';
  const Icon = action.icon;
  const className =
    variant === 'primary'
      ? 'bg-(--knu-primary) hover:bg-(--knu-primary-hover) text-white shadow-sm shadow-blue-600/20'
      : 'bg-white hover:bg-(--knu-background-alt) text-(--knu-text-primary) border border-(--knu-border)';

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
