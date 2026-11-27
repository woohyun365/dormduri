'use client';

import { useEffect, useState } from 'react';
import { LEGAL_TOC_JUMP_EVENT, decodeHash } from './jumpToHeading';

// How much of a part must be on screen to count as seen: 24px, or all of it when it is shorter.
const MIN_VISIBLE = 24;

export type VisibleHeadings = { visible: ReadonlySet<string>; current: string | null };

const NONE: VisibleHeadings = { visible: new Set(), current: null };

// The parts of the document on screen. A part runs from its heading to the next heading (the last one
// to the end of the body), and counts when enough of it shows between the sticky header and the
// bottom of the window. Long articles mark one entry; short ones (most of both documents run
// 140~300px) mark together, so the mark grows and shrinks instead of jumping one entry at a time, and
// no part is skipped at the page end (Owner 2026-11-16). `current` is the one entry assistive
// technology hears: the heading the reader jumped to while it is on screen, otherwise the topmost.
export function useVisibleHeadings(ids: string[]): VisibleHeadings {
  const [state, setState] = useState<VisibleHeadings>(NONE);
  const key = ids.join('|');

  useEffect(() => {
    const headings = key
      .split('|')
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    const body = headings[0]?.parentElement;
    if (!body) return undefined;

    let frame = 0;
    const update = () => {
      frame = 0;
      const header = document.querySelector('header');
      const top =
        header && getComputedStyle(header).position === 'sticky'
          ? header.getBoundingClientRect().bottom
          : 0;
      const bottom = window.innerHeight;
      const starts = headings.map((heading) => heading.getBoundingClientRect().top);
      const end = body.getBoundingClientRect().bottom;
      const visible = headings
        .filter((_, index) => {
          const start = starts[index] ?? 0;
          const stop = starts[index + 1] ?? end;
          const shown = Math.min(stop, bottom) - Math.max(start, top);
          return shown >= Math.min(MIN_VISIBLE, stop - start);
        })
        .map((heading) => heading.id);
      const hashId = decodeHash(window.location.hash);
      const current = visible.includes(hashId) ? hashId : (visible[0] ?? null);
      setState((previous) =>
        previous.current === current &&
        previous.visible.size === visible.length &&
        visible.every((id) => previous.visible.has(id))
          ? previous
          : { visible: new Set(visible), current },
      );
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', schedule);
    window.addEventListener(LEGAL_TOC_JUMP_EVENT, schedule);
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', schedule);
      window.removeEventListener(LEGAL_TOC_JUMP_EVENT, schedule);
    };
  }, [key]);

  return state;
}
