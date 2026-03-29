'use client';

import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

type GatingType = 'not_operated' | 'off_season' | 'season_open' | 'no_building';

interface MatchingEmptyStateProps {
  /** 게이팅 프리셋 사용 시 */
  type?: GatingType;
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  suggestions?: Array<{
    icon: string;
    text: string;
  }>;
}

const GATING_PRESETS: Record<
  GatingType,
  { title: string; description: string; iconGradient: string; textColor: string }
> = {
  not_operated: {
    title: '서비스 미운영 캠퍼스',
    description:
      '이 캠퍼스는 매칭 서비스를 운영하지 않습니다.\n현재 춘천캠퍼스만 서비스가 제공됩니다.',
    iconGradient: 'from-gray-200 to-slate-200',
    textColor: 'text-gray-600',
  },
  off_season: {
    title: '현재는 비시즌입니다',
    description: '프로필을 미리 완성해두면\n시즌이 시작될 때 바로 매칭에 참여할 수 있어요',
    iconGradient: 'from-blue-100 to-cyan-100',
    textColor: 'text-blue-600',
  },
  season_open: {
    title: '매칭 준비 중입니다',
    description: '프로필을 완성하고\n룸메 후보를 탐색해 보세요',
    iconGradient: 'from-cyan-100 to-blue-100',
    textColor: 'text-cyan-600',
  },
  no_building: {
    title: '건물을 선택해주세요',
    description: '건물을 선택하면\n룸메를 탐색할 수 있어요',
    iconGradient: 'from-amber-100 to-orange-100',
    textColor: 'text-amber-600',
  },
};

export function MatchingEmptyState({
  type,
  icon: Icon,
  title,
  description,
  action,
  suggestions,
}: MatchingEmptyStateProps) {
  const preset = type ? GATING_PRESETS[type] : null;

  const finalTitle = title ?? preset?.title ?? '데이터가 없어요';
  const finalDescription = description ?? preset?.description;
  const iconGradient = preset?.iconGradient ?? 'from-[var(--knu-primary-light)] to-blue-100';
  const iconColor = preset?.textColor ?? 'text-[var(--knu-primary)]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-center py-12 px-4"
    >
      {Icon && (
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            rotate: [0, 3, -3, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: 4,
            ease: 'easeInOut',
          }}
          className={`w-20 h-20 bg-gradient-to-br ${iconGradient} rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg`}
        >
          <Icon className={`w-10 h-10 ${iconColor}`} />
        </motion.div>
      )}

      <h3 className="text-xl font-bold text-[var(--knu-text-primary)] mb-2">{finalTitle}</h3>

      {finalDescription && (
        <p className="text-sm text-[var(--knu-text-secondary)] mb-6 leading-relaxed whitespace-pre-line">
          {finalDescription}
        </p>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="space-y-3 mb-6">
          {suggestions.map((suggestion, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-blue-50/80 backdrop-blur-sm border border-blue-200/60 rounded-xl p-3 text-left flex items-start gap-3"
            >
              <span className="text-xl flex-shrink-0">{suggestion.icon}</span>
              <p className="text-sm text-blue-800 leading-relaxed">{suggestion.text}</p>
            </motion.div>
          ))}
        </div>
      )}

      {action && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={action.onClick}
          className="px-6 py-3 bg-gradient-to-r from-[var(--knu-primary)] to-blue-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
        >
          {action.label}
        </motion.button>
      )}
    </motion.div>
  );
}
