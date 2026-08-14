'use client';

import { useRouter } from 'next/navigation';
import { LEGAL_DOCUMENT_COPY } from '../content/legal-copy';

function hasSameOriginReferrer(): boolean {
  if (!document.referrer) {
    return false;
  }

  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function LegalDocumentBackButton() {
  const router = useRouter();

  const handleClick = () => {
    if (hasSameOriginReferrer()) {
      router.back();
      return;
    }

    router.push('/');
  };

  return (
    <button
      type="button"
      aria-label={LEGAL_DOCUMENT_COPY.backActionAriaLabel}
      title={LEGAL_DOCUMENT_COPY.backActionAriaLabel}
      className="cursor-pointer rounded-md px-2 py-1 text-sm font-medium text-(--knu-primary) transition-colors hover:bg-(--knu-background-alt) focus-visible:outline-2 focus-visible:outline-offset-2"
      onClick={handleClick}
    >
      {LEGAL_DOCUMENT_COPY.backActionLabel}
    </button>
  );
}
