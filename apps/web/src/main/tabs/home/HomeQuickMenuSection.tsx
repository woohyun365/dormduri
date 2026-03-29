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

interface HomeQuickMenuSectionProps {
  seasonState: SeasonState;
  onNavigateList: () => void;
  onNavigateMatching: () => void;
  onNavigateChat: () => void;
  onNavigateProfile: () => void;
}

export function HomeQuickMenuSection({
  seasonState,
  onNavigateList,
  onNavigateMatching,
  onNavigateChat,
  onNavigateProfile,
}: HomeQuickMenuSectionProps) {
  const isMatching = seasonState === 'SEASON_MATCHING';
  const isOff = seasonState === 'OFF_SEASON';

  return (
    <div>
      <h2 className="font-bold text-[var(--knu-text-primary)] mb-3">빠른 메뉴</h2>
      <div className="grid grid-cols-2 gap-3">
        {/* 1. 룸메 찾기 */}
        <QuickActionCard
          icon={isMatching ? Users : Eye}
          label="룸메 찾기"
          description={isMatching ? '룸메 탐색' : '미리보기'}
          color="blue"
          onClick={onNavigateList}
        />

        {/* 2. 매칭 현황 / 이전 기록 */}
        {isOff ? (
          <QuickActionCard
            icon={History}
            label="이전 기록"
            description="지난 시즌"
            color="purple"
            onClick={onNavigateMatching}
          />
        ) : isMatching ? (
          <QuickActionCard
            icon={BarChart3}
            label="매칭 현황"
            description="현황 확인"
            color="purple"
            onClick={onNavigateMatching}
          />
        ) : (
          <QuickActionCard
            icon={History}
            label="이전 기록"
            description="지난 시즌"
            color="purple"
            onClick={onNavigateMatching}
          />
        )}

        {/* 3. 채팅 / 과거 대화 */}
        {isOff ? (
          <QuickActionCard
            icon={MessageCircle}
            label="과거 대화"
            description="기록 보기"
            color="green"
            disabled
            onClick={onNavigateChat}
          />
        ) : isMatching ? (
          <QuickActionCard
            icon={MessageCircle}
            label="채팅"
            description="준비 중"
            color="green"
            disabled
            onClick={onNavigateChat}
          />
        ) : (
          <QuickActionCard
            icon={Lock}
            label="채팅"
            description="시즌 중 이용"
            color="green"
            disabled
            onClick={onNavigateChat}
          />
        )}

        {/* 4. 내 프로필 */}
        <QuickActionCard
          icon={UserIcon}
          label="내 프로필"
          description="확인·수정"
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
  disabled,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  color: keyof typeof COLOR_STYLES;
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
