'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import type { LegalDocumentResponse } from '@repo/shared/legal';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { toLegalDocumentViewModel } from '../api/legal-document.mapper';
import { LegalDocumentSections } from './LegalDocumentSections';

interface LegalDocumentDialogProps {
  document: LegalDocumentResponse;
  onClose: () => void;
}

export function LegalDocumentDialog({
  document: legalDocument,
  onClose,
}: LegalDocumentDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const viewModel = useMemo(() => toLegalDocumentViewModel(legalDocument), [legalDocument]);

  useBodyScrollLock(true);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!dialogRef.current) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    const dialog = dialogRef.current;
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = dialog.querySelectorAll<HTMLElement>(focusableSelector);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    firstFocusable?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
        return;
      }

      if (event.key !== 'Tab') return;

      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable?.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable?.focus();
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    return () => {
      dialog.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [handleClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-black/50 sm:items-center"
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-document-dialog-title"
        className="max-h-[86vh] w-full max-w-3xl overscroll-contain overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-(--knu-border) p-4">
          <div>
            <p className="text-xs font-semibold text-(--knu-primary)">법적 안내 전문</p>
            <h3
              id="legal-document-dialog-title"
              className="mt-1 text-lg font-bold text-(--knu-text-primary)"
            >
              {viewModel.title}
            </h3>
            <p className="mt-1 text-xs text-(--knu-text-tertiary)">
              {viewModel.versionLabel} · 시행일 {viewModel.effectiveDateLabel}
            </p>
          </div>
          <button
            type="button"
            aria-label="문서 닫기"
            onClick={handleClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-(--knu-text-secondary) transition-colors hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          data-testid="legal-document-dialog-scroll-area"
          className="max-h-[68vh] space-y-6 overscroll-contain overflow-y-auto p-5"
        >
          {viewModel.summaryItems.length > 0 && (
            <section
              aria-labelledby="legal-dialog-summary-heading"
              className="rounded-2xl bg-(--knu-background-alt) p-4"
            >
              <h4
                id="legal-dialog-summary-heading"
                className="text-sm font-semibold text-(--knu-text-primary)"
              >
                핵심 요약
              </h4>
              <ul className="mt-3 space-y-2 pl-5 text-sm leading-6 text-(--knu-text-secondary)">
                {viewModel.summaryItems.map((item) => (
                  <li key={item} className="list-disc">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <LegalDocumentSections sections={viewModel.sections} />
        </div>
      </div>
    </div>
  );
}
