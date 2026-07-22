'use client';

import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function PairMatchingEmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = 'blue',
}: {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: ReactNode;
  readonly action?: { readonly label: string; readonly onClick: () => void };
  readonly tone?: 'blue' | 'cyan' | 'gray';
}) {
  const iconTone =
    tone === 'cyan'
      ? 'from-cyan-100 to-blue-100 text-cyan-600'
      : tone === 'gray'
        ? 'from-gray-200 to-slate-200 text-gray-600'
        : 'from-blue-100 to-cyan-100 text-blue-600';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      data-design-source="legacy-pair"
      className="px-4 py-12 text-center"
    >
      <motion.div
        animate={{ scale: [1, 1.05, 1], rotate: [0, 3, -3, 0] }}
        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br shadow-lg ${iconTone}`}
      >
        <Icon className="h-10 w-10" aria-hidden />
      </motion.div>
      <h2 className="mb-2 text-[1.55rem] font-bold text-[var(--knu-text-primary)]">{title}</h2>
      <p className="mb-6 text-sm leading-relaxed text-[var(--knu-text-secondary)]">{description}</p>
      {action ? (
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={action.onClick}
          className="rounded-xl bg-[var(--knu-primary)] px-6 py-3 font-bold text-white transition-all hover:bg-[var(--knu-primary-hover)]"
        >
          {action.label}
        </motion.button>
      ) : null}
    </motion.div>
  );
}
