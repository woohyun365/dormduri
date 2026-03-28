'use client';

import { motion } from 'motion/react';
import { Lock, AlertTriangle } from 'lucide-react';

interface GatingBannerProps {
  reason: 'no_building' | 'no_lifestyle_pattern';
  onAction: () => void;
}

const CONFIG = {
  no_building: {
    icon: AlertTriangle,
    title: '건물 배정이 필요해요',
    description: '건물을 배정해야 매칭을 시작할 수 있어요',
    actionLabel: '건물 배정하기',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    textColor: 'text-orange-900',
    descColor: 'text-orange-700',
    buttonBg: 'bg-orange-600',
    buttonHover: 'hover:bg-orange-700',
  },
  no_lifestyle_pattern: {
    icon: Lock,
    title: '생활패턴 입력이 필요해요',
    description: '생활패턴을 입력해야 매칭을 시작할 수 있어요',
    actionLabel: '생활패턴 입력하기',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    textColor: 'text-red-900',
    descColor: 'text-red-700',
    buttonBg: 'bg-red-600',
    buttonHover: 'hover:bg-red-700',
  },
} as const;

export function GatingBanner({ reason, onAction }: GatingBannerProps) {
  const { icon: Icon, title, description, actionLabel, ...colors } = CONFIG[reason];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${colors.bgColor} border-2 ${colors.borderColor} rounded-2xl p-4 keep-all`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 ${colors.iconBg} rounded-full flex items-center justify-center flex-shrink-0`}
        >
          <Icon className={`w-5 h-5 ${colors.iconColor}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`font-bold ${colors.textColor}`}>{title}</h3>
            <Lock className={`w-4 h-4 ${colors.iconColor}`} />
          </div>
          <p className={`text-sm ${colors.descColor} mb-3 leading-relaxed`}>{description}</p>

          <motion.button
            onClick={onAction}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full ${colors.buttonBg} ${colors.buttonHover} text-white font-medium py-2.5 px-4 rounded-xl transition-colors`}
          >
            {actionLabel}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
