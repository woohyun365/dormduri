'use client';

import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { UI_LAYER } from '@/styles/layers';

interface BaseBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerRight?: React.ReactNode;
  interactionDisabled?: boolean;
  layer?: 'base' | 'nested';
}

export function BaseBottomSheet({
  isOpen,
  onClose,
  title,
  children,
  footer,
  headerRight,
  interactionDisabled = false,
  layer = 'base',
}: BaseBottomSheetProps) {
  useBodyScrollLock(isOpen);
  const containerRef = useFocusTrap(isOpen && !interactionDisabled, onClose);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 flex items-end justify-center overflow-hidden overscroll-none px-0 pb-0 pt-4 outline-none sm:px-4 sm:pb-4 md:items-center md:py-4 ${
        interactionDisabled ? 'pointer-events-none' : ''
      }`}
      style={{ zIndex: layer === 'nested' ? UI_LAYER.nestedBottomSheet : UI_LAYER.bottomSheet }}
      role="dialog"
      aria-modal={!interactionDisabled}
      aria-hidden={interactionDisabled || undefined}
      inert={interactionDisabled || undefined}
      aria-label={title}
      ref={containerRef}
      tabIndex={-1}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative flex h-[min(90dvh,720px)] w-full min-w-0 max-w-dvw flex-col overflow-hidden rounded-t-3xl border border-(--knu-border) bg-white shadow-2xl ring-1 ring-black/5 sm:max-w-3xl md:h-auto md:max-h-[min(760px,calc(100dvh-2rem))] md:rounded-3xl">
        {/* Header */}
        <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-(--knu-border) bg-white px-5 py-4 md:rounded-t-3xl">
          <h2 className="text-xl font-bold text-(--knu-text-primary)">{title}</h2>
          <div className="flex items-center gap-1">
            {headerRight}
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-slate-100"
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
          <div className="relative z-10 shrink-0 border-t border-(--knu-border) bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
