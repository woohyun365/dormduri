'use client';

import { TrendingUp, Clock } from 'lucide-react';
import { motion } from 'motion/react';

export type SortOption = 'matchScore' | 'latest';

interface SortToggleProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export function SortToggle({ value, onChange }: SortToggleProps) {
  return (
    <div className="flex items-center gap-2 p-1 rounded-xl bg-white border-2 border-[var(--knu-border)]">
      <SortButton
        active={value === 'matchScore'}
        onClick={() => onChange('matchScore')}
        icon={<TrendingUp className="w-3.5 h-3.5 relative z-10" />}
        label="매칭도순"
        layoutId="sortBg"
      />
      <SortButton
        active={value === 'latest'}
        onClick={() => onChange('latest')}
        icon={<Clock className="w-3.5 h-3.5 relative z-10" />}
        label="최신순"
        layoutId="sortBg"
      />
    </div>
  );
}

function SortButton({
  active,
  onClick,
  icon,
  label,
  layoutId,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  layoutId: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
        active
          ? 'text-[var(--knu-primary)]'
          : 'text-[var(--knu-text-tertiary)] hover:text-[var(--knu-text-secondary)]'
      }`}
    >
      {active && (
        <motion.div
          layoutId={layoutId}
          className="absolute inset-0 bg-[var(--knu-primary-light)] rounded-lg"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      {icon}
      <span className="relative z-10">{label}</span>
    </button>
  );
}
