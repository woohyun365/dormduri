'use client';

import { X } from 'lucide-react';
import type { ElementType, ReactNode } from 'react';

export type HomeDialogTone = 'blue' | 'indigo';

type DialogIcon = ElementType<{ className?: string; 'aria-hidden'?: boolean }>;

interface HomeDialogHeaderProps {
  eyebrow: string;
  title: string;
  description: ReactNode;
  icon: DialogIcon;
  onClose: () => void;
  tone?: HomeDialogTone;
  preserveLineBreaks?: boolean;
}

const HEADER_TONE_CLASS_NAME: Record<
  HomeDialogTone,
  { header: string; icon: string; eyebrow: string }
> = {
  blue: {
    header: 'bg-linear-to-br from-blue-50 to-cyan-50',
    icon: 'bg-blue-100 text-blue-600',
    eyebrow: 'text-blue-700',
  },
  indigo: {
    header: 'bg-linear-to-br from-indigo-50 to-cyan-50',
    icon: 'bg-indigo-100 text-indigo-600',
    eyebrow: 'text-indigo-700',
  },
};

export function HomeDialogHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  onClose,
  tone = 'blue',
  preserveLineBreaks = false,
}: HomeDialogHeaderProps) {
  const toneClassName = HEADER_TONE_CLASS_NAME[tone];
  const descriptionClassName = preserveLineBreaks
    ? 'mt-1 text-sm leading-relaxed whitespace-pre-line text-(--knu-text-secondary)'
    : 'mt-1 text-sm leading-relaxed text-(--knu-text-secondary)';

  return (
    <div className={`shrink-0 p-5 ${toneClassName.header}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${toneClassName.icon}`}
          >
            <Icon className="size-5" aria-hidden={true} />
          </span>
          <div className="min-w-0">
            <p className={`text-xs font-bold ${toneClassName.eyebrow}`}>{eyebrow}</p>
            <h3 className="text-lg font-extrabold text-(--knu-text-primary)">{title}</h3>
            <p className={descriptionClassName}>{description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-(--knu-text-secondary) transition-colors hover:bg-white hover:text-(--knu-text-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary)"
          aria-label="닫기"
        >
          <X className="size-5" aria-hidden={true} />
        </button>
      </div>
    </div>
  );
}
