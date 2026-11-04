'use client';

import { useEffect, useRef } from 'react';
import type { LandingScheme } from './LandingFrame';

// Where the browser paints outside the page (overscroll, the safe area), it uses the html and body
// background, which the app theme keeps white (globals.css). While the landing route is on screen, html
// and body take the landing frame's background; leaving the landing restores what they had. Only the
// route screen renders this, not the section stories.
export function LandingDocumentBackground({ scheme }: { scheme: LandingScheme }) {
  const markerRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const frame = markerRef.current?.closest('[data-palette]');
    if (!frame) return;
    const background = getComputedStyle(frame).backgroundColor;
    const saved = [document.documentElement, document.body].map((element) => ({
      element,
      value: element.style.backgroundColor,
    }));
    for (const { element } of saved) element.style.backgroundColor = background;
    return () => {
      for (const { element, value } of saved) element.style.backgroundColor = value;
    };
  }, [scheme]);
  return <span ref={markerRef} hidden />;
}
