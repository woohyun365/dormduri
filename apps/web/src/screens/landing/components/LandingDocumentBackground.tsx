'use client';

import { useEffect, useRef } from 'react';
import type { LandingScheme } from './LandingFrame';

// Where the browser paints outside the page (overscroll, the safe area), it uses the html and body
// background, which the app theme keeps white (globals.css). While the landing route is on screen, html
// and body take the landing frame's background; leaving the landing restores what they had. Only the
// route screen renders this, not the section stories. Two landings on one document (a docs page with
// both schemes) share one saved value: the first to mount saves it and the last to unmount restores it.
let mounted = 0;
let saved: { element: HTMLElement; value: string }[] = [];

export function LandingDocumentBackground({ scheme }: { scheme: LandingScheme }) {
  const markerRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const frame = markerRef.current?.closest('[data-palette]');
    if (!frame) return;
    const targets = [document.documentElement, document.body];
    if (mounted === 0) {
      saved = targets.map((element) => ({ element, value: element.style.backgroundColor }));
    }
    mounted += 1;
    const background = getComputedStyle(frame).backgroundColor;
    for (const element of targets) element.style.backgroundColor = background;
    return () => {
      mounted -= 1;
      if (mounted > 0) return;
      for (const { element, value } of saved) element.style.backgroundColor = value;
      saved = [];
    };
  }, [scheme]);
  return <span ref={markerRef} hidden />;
}
