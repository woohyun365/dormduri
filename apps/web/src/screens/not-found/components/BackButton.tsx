'use client';

import { goesBack } from '../model/backTarget';
import { notFoundCopy } from '../model/notFoundCopy';
import { quietButton } from './buttons';

// Back to the page the reader came from on this site, or home otherwise (model/backTarget.ts). The
// root not-found file ships its client parts with every page, so this is the screen's only one and it
// uses the browser's history and location instead of the Next router, which keeps that chunk near 1KB.
export function BackButton() {
  function onClick() {
    const [entry] = performance.getEntriesByType('navigation');
    // The Navigation API is missing in some browsers even though the DOM types declare it.
    const current = 'navigation' in window ? window.navigation.currentEntry : null;
    const back = goesBack({
      sameSiteBefore: current ? current.index > 0 : null,
      firstUrl: entry?.name ?? null,
      referrer: document.referrer,
      currentUrl: window.location.href,
      historyLength: window.history.length,
    });
    if (back) window.history.back();
    else window.location.assign(new URL('/', window.location.origin));
  }
  return (
    <button type="button" className={quietButton} onClick={onClick}>
      {notFoundCopy.backLabel}
    </button>
  );
}
