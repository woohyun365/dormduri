'use client';

import { motion } from 'motion/react';
import { DEADLINE_TONE_STYLES } from './model/primaryStyles';
import type { PrimaryProgress } from './model/primaryTypes';

export function PrimaryProgressBar({ progress }: { progress: PrimaryProgress }) {
  const progressTone = DEADLINE_TONE_STYLES[progress.tone ?? 'normal'];

  return (
    <div
      className={`rounded-xl border p-3 shadow-sm shadow-slate-200/50 backdrop-blur-sm ${DEADLINE_TONE_STYLES.normal.panel}`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-xs text-(--knu-text-tertiary)">{progress.label}</span>
        <span className={`text-xs font-bold ${progressTone.text}`}>{progress.value}</span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-white shadow-inner ring-1 ring-blue-100/80">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${progressTone.fill}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress.percent}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
