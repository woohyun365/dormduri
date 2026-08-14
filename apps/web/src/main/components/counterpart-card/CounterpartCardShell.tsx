'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

export type CounterpartCardTone = 'neutral' | 'sent' | 'received' | 'terminal';

const TONE_CLASS: Record<CounterpartCardTone, string> = {
  neutral: 'border-(--knu-border)',
  sent: 'border-sky-200',
  received: 'border-violet-200',
  terminal: 'border-(--knu-border) opacity-75',
};

export function CounterpartCardShell({
  labelledBy,
  tone,
  animated = false,
  interactive = false,
  busy = false,
  testId,
  designSource,
  className = '',
  children,
}: {
  readonly labelledBy: string;
  readonly tone: CounterpartCardTone;
  readonly animated?: boolean;
  readonly interactive?: boolean;
  readonly busy?: boolean;
  readonly testId?: string;
  readonly designSource?: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <motion.article
      initial={animated ? { opacity: 0, y: 10 } : false}
      animate={animated ? { opacity: 1, y: 0 } : undefined}
      aria-labelledby={labelledBy}
      aria-busy={busy || undefined}
      data-testid={testId}
      data-tone={tone}
      data-design-source={designSource}
      className={`rounded-2xl border-2 bg-white p-4 shadow-sm transition-all ${TONE_CLASS[tone]} ${
        interactive ? 'group hover:-translate-y-0.5 hover:border-indigo-100 hover:shadow-xl' : ''
      } ${className}`}
    >
      {children}
    </motion.article>
  );
}
