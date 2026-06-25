'use client';

import { motion } from 'motion/react';
import {
  Users,
  Eye,
  BarChart3,
  History,
  MessageCircle,
  Lock,
  User as UserIcon,
} from 'lucide-react';
import type { SeasonState } from '@/types/season';
import {
  buildHomeQuickActions,
  type HomeQuickAction,
  type HomeQuickActionIcon,
  type HomeQuickActionTarget,
} from '../model/homeActionPolicy';

interface HomeQuickMenuSectionProps {
  seasonState: SeasonState;
  hasCurrentSeason?: boolean;
  canEnterRoommateSearch?: boolean;
  canStartChat?: boolean;
  canViewMatchHistory?: boolean;
  onNavigateList: () => void;
  onNavigateMatching: () => void;
  onNavigateMatchingHistory: () => void;
  onNavigateChat: () => void;
  onNavigateProfile: () => void;
}

export function HomeQuickMenuSection({
  seasonState,
  hasCurrentSeason,
  canEnterRoommateSearch,
  canStartChat,
  canViewMatchHistory,
  onNavigateList,
  onNavigateMatching,
  onNavigateMatchingHistory,
  onNavigateChat,
  onNavigateProfile,
}: HomeQuickMenuSectionProps) {
  const actions = buildHomeQuickActions({
    seasonState,
    hasCurrentSeason,
    canEnterRoommateSearch,
    canStartChat,
    canViewMatchHistory,
  });
  const handlers: Record<HomeQuickActionTarget, () => void> = {
    list: onNavigateList,
    'matching-current': onNavigateMatching,
    'matching-history': onNavigateMatchingHistory,
    chat: onNavigateChat,
    profile: onNavigateProfile,
  };

  return (
    <div>
      <h2 className="font-bold text-(--knu-text-primary) mb-3">빠른 메뉴</h2>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, index) => (
          <QuickActionCard
            key={`${action.target}:${action.label}`}
            action={action}
            onClick={handlers[action.target]}
            reasonId={`home-quick-action-${index}-reason`}
          />
        ))}
      </div>
    </div>
  );
}

const COLOR_STYLES = {
  blue: 'bg-blue-100 text-blue-600',
  purple: 'bg-purple-100 text-purple-600',
  green: 'bg-green-100 text-green-600',
  orange: 'bg-orange-100 text-orange-600',
} as const;

const ICONS: Record<HomeQuickActionIcon, React.ElementType> = {
  users: Users,
  eye: Eye,
  'bar-chart': BarChart3,
  history: History,
  'message-circle': MessageCircle,
  lock: Lock,
  user: UserIcon,
};

function QuickActionCard({
  action,
  onClick,
  reasonId,
}: {
  action: HomeQuickAction;
  onClick: () => void;
  reasonId: string;
}) {
  const Icon = ICONS[action.icon];
  const describedBy = action.disabledReason ? reasonId : undefined;

  return (
    <motion.button
      whileHover={action.disabled ? undefined : { scale: 1.02 }}
      whileTap={action.disabled ? undefined : { scale: 0.98 }}
      onClick={action.disabled ? undefined : onClick}
      disabled={Boolean(action.disabled)}
      aria-disabled={action.disabled ? 'true' : undefined}
      aria-describedby={describedBy}
      className={`relative bg-white rounded-2xl border-2 border-(--knu-border) p-4 text-left transition-all ${
        action.disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:border-(--knu-primary) hover:shadow-sm'
      }`}
    >
      <div
        className={`w-10 h-10 ${COLOR_STYLES[action.color]} rounded-xl flex items-center justify-center mb-2.5`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-bold text-sm text-(--knu-text-primary) mb-0.5">{action.label}</h3>
      <p className="text-xs text-(--knu-text-tertiary)">{action.description}</p>
      {action.disabledReason && (
        <p id={reasonId} className="mt-2 text-[11px] leading-relaxed text-amber-700">
          {action.disabledReason}
        </p>
      )}
    </motion.button>
  );
}
