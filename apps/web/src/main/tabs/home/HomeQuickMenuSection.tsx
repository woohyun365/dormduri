'use client';

import { motion } from 'motion/react';
import { Users, BarChart3, MessageCircle, User as UserIcon } from 'lucide-react';

interface HomeQuickMenuSectionProps {
  onNavigateList: () => void;
  onNavigateMatching: () => void;
  onNavigateChat: () => void;
  onNavigateProfile: () => void;
  receivedPendingCount?: number;
}

export function HomeQuickMenuSection({
  onNavigateList,
  onNavigateMatching,
  onNavigateChat,
  onNavigateProfile,
  receivedPendingCount = 0,
}: HomeQuickMenuSectionProps) {
  return (
    <div>
      <h2 className="font-bold text-[var(--knu-text-primary)] mb-3">빠른 메뉴</h2>
      <div className="grid grid-cols-2 gap-3">
        <QuickActionCard
          icon={Users}
          label="룸메 찾기"
          description="프로필 탐색"
          color="blue"
          onClick={onNavigateList}
        />
        <QuickActionCard
          icon={BarChart3}
          label="매칭 현황"
          description="요청 관리"
          color="purple"
          badge={receivedPendingCount > 0 ? receivedPendingCount : undefined}
          onClick={onNavigateMatching}
        />
        <QuickActionCard
          icon={MessageCircle}
          label="채팅"
          description="준비 중"
          color="green"
          disabled
          onClick={onNavigateChat}
        />
        <QuickActionCard
          icon={UserIcon}
          label="내 프로필"
          description="정보 수정"
          color="orange"
          onClick={onNavigateProfile}
        />
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

function QuickActionCard({
  icon: Icon,
  label,
  description,
  color,
  badge,
  disabled,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  color: keyof typeof COLOR_STYLES;
  badge?: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={disabled ? undefined : onClick}
      className={`relative bg-white rounded-2xl border-2 border-[var(--knu-border)] p-4 text-left transition-all ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:border-[var(--knu-primary)] hover:shadow-sm'
      }`}
    >
      {badge !== undefined && badge > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center z-10"
        >
          <span className="text-xs font-bold text-white">{badge}</span>
        </motion.div>
      )}
      <div
        className={`w-10 h-10 ${COLOR_STYLES[color]} rounded-xl flex items-center justify-center mb-2.5`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-bold text-sm text-[var(--knu-text-primary)] mb-0.5">{label}</h3>
      <p className="text-xs text-[var(--knu-text-tertiary)]">{description}</p>
    </motion.button>
  );
}
