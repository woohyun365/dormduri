import type { MouseEvent } from 'react';

export function decodeHash(hash: string): string {
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return hash.slice(1);
  }
}

// Sent after a table-of-contents jump: replaceState changes the address without a hashchange event.
export const LEGAL_TOC_JUMP_EVENT = 'legal-toc-jump';

// A table-of-contents link moves to its heading without adding a history entry (Owner 2026-11-16):
// the address shows the article, so a copied address opens there, while the browser's back button and
// '이전 화면으로' go to the previous page instead of the previous article. The heading takes focus so
// the next Tab continues in the article. A modified click (new tab, new window) is left to the browser.
export function jumpToHeading(event: MouseEvent<HTMLAnchorElement>, id: string): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  window.history.replaceState(window.history.state, '', `#${encodeURIComponent(id)}`);
  // `auto` follows the page's scroll-behavior: smooth, or instant under reduced motion.
  target.scrollIntoView({ block: 'start' });
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  window.dispatchEvent(new Event(LEGAL_TOC_JUMP_EVENT));
}
