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
      className="fixed inset-0 flex items-end"
      style={{ zIndex: Z_INDEX.bottomSheet }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      ref={containerRef}
      tabIndex={-1}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full bg-white rounded-t-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[var(--knu-border)] px-5 py-4 flex items-center justify-between rounded-t-3xl flex-shrink-0">
          <h2 className="text-xl font-bold text-[var(--knu-text-primary)]">{title}</h2>
          <div className="flex items-center gap-1">
            {headerRight}
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--knu-background-alt)] transition-colors"
              aria-label="닫기"
            >
              <X className="w-6 h-6 text-[var(--knu-text-secondary)]" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="sticky bottom-0 bg-white border-t border-[var(--knu-border)] p-5 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
