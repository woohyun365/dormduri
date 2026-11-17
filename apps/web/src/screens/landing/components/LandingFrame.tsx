'use client';

import { useRef, type ReactNode } from 'react';
import { useSectionReveal } from './useSectionReveal';

// The landing's root: the dark palette context (the landing is drawn dark only and does not follow the
// OS color setting), the body font, and the scroll entrance for the sections inside it. Section
// stories render in it too; the page passes its full-height class.
export function LandingFrame({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useSectionReveal(rootRef);
  return (
    <div
      ref={rootRef}
      data-palette="dark"
      className={`bg-layer-basement font-body text-fg-neutral ${className}`}
    >
      {children}
    </div>
  );
}
