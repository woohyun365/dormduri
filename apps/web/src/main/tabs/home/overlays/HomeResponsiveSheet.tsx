'use client';

import { motion } from 'motion/react';
import { UI_LAYER } from '@/styles/layers';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { HomeDialogHeader, type HomeDialogTone } from './HomeDialogHeader';
import { HomeModalActionBar } from './HomeModalActionBar';
import type { ElementType, ReactNode } from 'react';

type SheetIcon = ElementType<{ className?: string; 'aria-hidden'?: boolean }>;

interface HomeResponsiveSheetProps {
  eyebrow: string;
  title: string;
  description: ReactNode;
  icon: SheetIcon;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
  label?: string;
  backdropLabel?: string;
  tone?: HomeDialogTone;
}

export function HomeResponsiveSheet({
  eyebrow,
  title,
  description,
  icon,
  children,
  footer,
  onClose,
  label,
  backdropLabel,
  tone = 'blue',
}: HomeResponsiveSheetProps) {
  useBodyScrollLock(true);
  const containerRef = useFocusTrap(true, onClose);
  const accessibleLabel = label ?? title;

  return (
    <div
      className="fixed inset-0 flex items-end justify-center overflow-hidden overscroll-none bg-slate-950/40 px-0 pb-0 pt-4 sm:px-4 sm:pb-4 md:items-center md:py-4"
      style={{ zIndex: UI_LAYER.bottomSheet }}
    >
      <button
        type="button"
        aria-label={backdropLabel ?? `${accessibleLabel} 닫기`}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={accessibleLabel}
        tabIndex={-1}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative flex h-[min(620px,calc(100dvh-1rem))] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-black/5 sm:h-auto sm:max-h-[min(680px,calc(100dvh-2rem))] sm:rounded-3xl"
      >
        <HomeDialogHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          icon={icon}
          onClose={onClose}
          tone={tone}
          preserveLineBreaks={true}
        />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">{children}</div>

        <HomeModalActionBar>{footer}</HomeModalActionBar>
      </motion.div>
    </div>
  );
}
