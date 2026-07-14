'use client';

import { X } from 'lucide-react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Z_INDEX } from '@/constants/ui';

interface BaseBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerRight?: React.ReactNode;
}

export function BaseBottomSheet({
  isOpen,
  onClose,
  title,
  children,
  footer,
  headerRight,
}: BaseBottomSheetProps) {
  useBodyScrollLock(isOpen);
  const containerRef = useFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-end justify-center overflow-hidden overscroll-none px-0 pb-0 pt-4 outline-none sm:px-4 sm:pb-4 md:items-center md:py-4"
      style={{ zIndex: Z_INDEX.bottomSheet }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      ref={containerRef}
      tabIndex={-1}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative flex h-[min(90dvh,720px)] w-full min-w-0 max-w-[100dvw] flex-col overflow-hidden rounded-t-3xl border border-(--knu-border) bg-white shadow-2xl ring-1 ring-black/5 sm:max-w-3xl md:h-auto md:max-h-[min(760px,calc(100dvh-2rem))] md:rounded-3xl">
        {/* Header */}
        <div className="sticky top-0 flex shrink-0 items-center justify-between border-b border-(--knu-border) bg-white px-5 py-4 md:rounded-t-3xl">
          <h2 className="text-xl font-bold text-(--knu-text-primary)">{title}</h2>
          <div className="flex items-center gap-1">
            {headerRight}
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-(--knu-background-alt)"
              aria-label="닫기"
            >
              <X className="h-6 w-6 text-(--knu-text-secondary)" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="sticky bottom-0 shrink-0 border-t border-(--knu-border) bg-white p-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
