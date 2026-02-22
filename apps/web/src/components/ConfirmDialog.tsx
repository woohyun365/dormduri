'use client';

import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Button } from '@/components/Button';
import { Z_INDEX } from '@/constants/ui';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'default',
}: ConfirmDialogProps) {
  useBodyScrollLock(isOpen);
  const containerRef = useFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-5"
      style={{ zIndex: Z_INDEX.toast }}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      ref={containerRef}
      tabIndex={-1}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h3 className="text-lg font-bold text-[var(--knu-text-primary)] mb-2">{title}</h3>
        <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed whitespace-pre-line mb-6">
          {message}
        </p>

        <div className="flex gap-3">
          <div className="flex-1">
            <Button variant="outline" fullWidth onClick={onClose}>
              {cancelLabel}
            </Button>
          </div>
          <div className="flex-1">
            <Button
              variant={variant === 'danger' ? 'danger' : 'primary'}
              fullWidth
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
