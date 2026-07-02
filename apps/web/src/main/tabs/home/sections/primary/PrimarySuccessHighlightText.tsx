'use client';

import { Megaphone } from 'lucide-react';
import { motion } from 'motion/react';
import type { PrimarySuccessHighlight } from './model/primaryTypes';

export function PrimarySuccessHighlightText({ highlight }: { highlight: PrimarySuccessHighlight }) {
  const tone =
    highlight.urgency === 'critical'
      ? {
          text: 'text-rose-900',
          number: 'text-rose-600',
          colors: ['#e11d48', '#9f1239', '#e11d48'],
        }
      : highlight.urgency === 'warning'
        ? {
            text: 'text-amber-950',
            number: 'text-amber-700',
            colors: ['#b45309', '#92400e', '#b45309'],
          }
        : {
            text: 'text-indigo-900/80',
            number: 'text-purple-600',
            colors: ['#9333ea', '#6b21a8', '#9333ea'],
          };

  return (
    <motion.p
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0, scale: [1, 1.012, 1] }}
      transition={{
        opacity: { duration: 0.35 },
        y: { duration: 0.35 },
        scale: { duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 },
      }}
      className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${tone.text}`}
    >
      <Megaphone className="mr-1 inline-block h-3.5 w-3.5 align-text-bottom" />
      {highlight.text}{' '}
      <motion.span
        animate={{ color: tone.colors }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        className={`text-base font-extrabold ${tone.number}`}
      >
        {highlight.count}명
      </motion.span>
      이 룸메 매칭을 확정했어요.
    </motion.p>
  );
}
