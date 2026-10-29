'use client';

import Link from 'next/link';
import type { MouseEvent, ReactNode } from 'react';
import { prefersReducedMotion } from './useReducedMotion';

// The header logo's link home. On the landing a link to `/` changes nothing, so Next neither navigates
// nor scrolls: a plain click scrolls back to the top instead (at once under reduced motion), without a
// reload, and drops a #section the address came with (a shared link); the query stays. A click with a
// modifier key (a new tab or window) stays the browser's.
export function HomeLink({ className, children }: { className: string; children: ReactNode }) {
  function backToTop(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    if (window.location.pathname !== '/') return;
    event.preventDefault();
    if (window.location.hash) {
      const { pathname, search } = window.location;
      window.history.replaceState(window.history.state, '', `${pathname}${search}`);
    }
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  return (
    <Link href="/" className={className} onClick={backToTop}>
      {children}
    </Link>
  );
}
