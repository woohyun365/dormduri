'use client';

import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import type { PrimaryAction } from './model/primaryTypes';

export function ActionButton({ action }: { action: PrimaryAction }) {
  const variant = action.variant ?? 'primary';
  const Icon = action.icon;
  const className =
    variant === 'primary'
      ? 'bg-white/85 hover:bg-white border border-white/80 text-(--knu-text-primary) shadow-sm shadow-slate-200/60 backdrop-blur-sm'
      : variant === 'warning'
        ? 'bg-amber-50/80 hover:bg-amber-100 text-amber-900 border border-amber-200 shadow-sm shadow-amber-100/50 backdrop-blur-sm'
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
