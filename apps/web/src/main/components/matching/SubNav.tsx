'use client';

import { motion } from 'motion/react';

interface SubNavOption {
  id: string;
  label: string;
  badge?: number;
}

interface SubNavProps {
  options: SubNavOption[];
  selected: string;
  onChange: (id: string) => void;
  /** motion layoutId 충돌 방지용 (한 화면에 SubNav가 2개일 때) */
  layoutId?: string;
}

export function SubNav({ options, selected, onChange, layoutId = 'subNavBg' }: SubNavProps) {
  return (
    <div className="flex gap-2 rounded-xl border-2 border-[var(--knu-border)] bg-[var(--knu-background-alt)] p-1">
      {options.map((option) => {
        const isSelected = selected === option.id;

        return (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={`flex-1 relative rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${
              isSelected
                ? 'text-[var(--knu-primary)]'
                : 'text-[var(--knu-text-tertiary)] hover:text-[var(--knu-text-secondary)]'
            }`}
          >
            {isSelected && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg border border-[var(--knu-border)] bg-white shadow-sm"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative z-10">
              {option.label}
              {option.badge !== undefined && option.badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
                  {option.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
