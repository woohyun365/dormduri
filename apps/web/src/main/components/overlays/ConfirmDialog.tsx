'use client';

import { AlertTriangle } from 'lucide-react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Button } from '@/components/ui/Button';
import { UI_LAYER } from '@/styles/layers';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  /** 본문 하단에 amber 경고 라인으로 표시 */
  warning?: string;
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
  warning,
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
      style={{ zIndex: UI_LAYER.dialog }}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      ref={containerRef}
      tabIndex={-1}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h3 className="text-lg font-bold text-(--knu-text-primary) mb-2">{title}</h3>
        <p className="text-sm text-(--knu-text-secondary) leading-relaxed whitespace-pre-line mb-4">
          {message}
        </p>
        {warning && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-amber-800 leading-relaxed">{warning}</p>
          </div>
        )}

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
