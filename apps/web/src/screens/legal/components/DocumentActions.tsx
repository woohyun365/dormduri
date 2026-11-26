'use client';

import { useState } from 'react';
// The button looks only: the controls entry also exports the back button, which this client part does not use.
import { controlButton } from '@/screens/ui/controls/buttons';
import { legalScreenCopy } from '../model/legalScreenCopy';

// Print (the paper copy, G-LU6) and copying this page's address.
export function DocumentActions() {
  const [status, setStatus] = useState<string | null>(null);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus(legalScreenCopy.copyLinkDone);
    } catch {
      setStatus(legalScreenCopy.copyLinkUnavailable);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <div role="group" aria-label={legalScreenCopy.actionsLabel} className="flex gap-2">
        <button type="button" className={controlButton} onClick={() => window.print()}>
          {legalScreenCopy.printLabel}
        </button>
        <button type="button" className={controlButton} onClick={copyLink}>
          {legalScreenCopy.copyLinkLabel}
        </button>
      </div>
      <p role="status" className="text-body-sm text-fg-muted">
        {status}
      </p>
    </div>
  );
}
