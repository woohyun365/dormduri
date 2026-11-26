'use client';

import { goesBack } from '../model/backTarget';
import { quietButton } from './buttons';

// Back to the page the reader came from on this site, or home otherwise (model/backTarget.ts). The root
// not-found file ships its client parts with every page, so this button uses the browser's history and
// location instead of the Next router, which keeps that chunk near 1KB. Going home is a full load.
// `samePlacePaths` are addresses that count as this same place: the Legal screens pass both documents,
// so after switching between them or reopening one, going back leaves the Legal pages.
export function BackButton({
  label,
  samePlacePaths,
  className,
}: {
  label: string;
  samePlacePaths?: readonly string[];
  className?: string;
}) {
  function onClick() {
    const [entry] = performance.getEntriesByType('navigation');
    // The Navigation API is missing in some browsers even though the DOM types declare it.
    const navigation = 'navigation' in window ? window.navigation : null;
    const current = navigation?.currentEntry ?? null;
    const before = current && current.index > 0 ? navigation?.entries()[current.index - 1] : null;
    const back = goesBack({
      sameSiteBefore: current ? current.index > 0 : null,
      entryBeforeUrl: before?.url ?? null,
      firstUrl: entry?.name ?? null,
      referrer: document.referrer,
      currentUrl: window.location.href,
      historyLength: window.history.length,
      samePlacePaths,
    });
    if (back) window.history.back();
    else window.location.assign(new URL('/', window.location.origin));
  }
  return (
    <button
      type="button"
      className={className ? `${quietButton} ${className}` : quietButton}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
