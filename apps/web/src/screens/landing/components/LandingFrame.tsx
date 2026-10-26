'use client';

import { useRef, type ReactNode } from 'react';
import { useSectionReveal } from './useSectionReveal';

export type LandingScheme = 'dark' | 'light';

// The landing's root: the dark or light palette context (dark first), the body
// font, and the scroll entrance for the sections inside it. Section stories render in it too; the page
// passes its full-height class.
export function LandingFrame({
  scheme,
  className = '',
  children,
}: {
  scheme: LandingScheme;
  className?: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useSectionReveal(rootRef);
  return (
    <div
      ref={rootRef}
      data-palette={scheme}
      className={`bg-layer-basement font-body text-fg-neutral ${className}`}
    >
      {children}
    </div>
  );
}
