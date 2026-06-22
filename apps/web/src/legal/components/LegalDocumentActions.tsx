'use client';

import { useState } from 'react';
import { LEGAL_DOCUMENT_COPY } from '../content/legal-copy';

export function LegalDocumentActions() {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = async () => {
    if (!navigator.clipboard) {
      setCopyStatus(LEGAL_DOCUMENT_COPY.copyLinkUnavailableLabel);
      return;
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyStatus(LEGAL_DOCUMENT_COPY.copyLinkSuccessLabel);
    } catch {
      setCopyStatus(LEGAL_DOCUMENT_COPY.copyLinkUnavailableLabel);
    }
  };

  return (
    <div
      className="mt-6 flex flex-wrap items-center gap-2"
      aria-label={LEGAL_DOCUMENT_COPY.actionsLabel}
    >
      <button
        type="button"
        className="rounded-full border border-(--knu-border) px-4 py-2 text-sm font-semibold text-(--knu-text-primary) transition-colors hover:border-(--knu-primary) hover:text-(--knu-primary) focus-visible:outline-2"
        onClick={handlePrint}
      >
        {LEGAL_DOCUMENT_COPY.printActionLabel}
      </button>
      <button
        type="button"
        className="rounded-full border border-(--knu-border) px-4 py-2 text-sm font-semibold text-(--knu-text-primary) transition-colors hover:border-(--knu-primary) hover:text-(--knu-primary) focus-visible:outline-2"
        onClick={handleCopyLink}
      >
        {LEGAL_DOCUMENT_COPY.copyLinkActionLabel}
      </button>
      {copyStatus && (
        <p className="text-sm text-(--knu-text-secondary)" role="status">
          {copyStatus}
        </p>
      )}
    </div>
  );
}
