'use client';

import { useEffect } from 'react';
import { decodeHash } from './jumpToHeading';

// Opening an address with an article (#…) lands on that heading. The browser jumps while the page is
// still loading, and the fonts that arrive afterwards reflow the text above, so the heading ends up
// short of or past its place. After the page has loaded and its fonts are in, the page moves there
// again at once, unless the reader has started scrolling by then.
export function InitialHashJump() {
  useEffect(() => {
    const id = decodeHash(window.location.hash);
    if (!id) return undefined;
    let done = false;
    const stop = () => {
      done = true;
    };
    const jump = () => {
      void document.fonts.ready.then(() => {
        window.requestAnimationFrame(() => {
          if (done) return;
          done = true;
          document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'start' });
        });
      });
    };
    const userInput = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    for (const type of userInput)
      window.addEventListener(type, stop, { passive: true, once: true });
    if (document.readyState === 'complete') jump();
    else window.addEventListener('load', jump, { once: true });
    return () => {
      done = true;
      window.removeEventListener('load', jump);
      for (const type of userInput) window.removeEventListener(type, stop);
    };
  }, []);
  return null;
}
