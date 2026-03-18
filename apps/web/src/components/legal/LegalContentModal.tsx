'use client';

import { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

interface LegalContentModalProps {
  title: string;
  content: string;
  onClose: () => void;
}

export function LegalContentModal({ title, content, onClose }: LegalContentModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!modalRef.current) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    const modal = modalRef.current;
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = modal.querySelectorAll<HTMLElement>(focusableSelector);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    firstFocusable?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleKeyDown);
    return () => {
      modal.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [handleClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
      onClick={handleClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        className="bg-white w-full max-w-lg max-h-[80vh] rounded-t-2xl sm:rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--knu-border)]">
          <h3 id="legal-modal-title" className="font-bold text-lg text-[var(--knu-text-primary)]">
            {title}
          </h3>
          <button
            aria-label="닫기"
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-[var(--knu-text-secondary)]" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <p className="text-sm text-[var(--knu-text-secondary)] leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        </div>
      </div>
    </div>
  );
}
