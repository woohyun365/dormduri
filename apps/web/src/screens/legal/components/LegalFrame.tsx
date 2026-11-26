import type { ReactNode } from 'react';

// The legal screens' root: the light palette on a white page so the document reads like an A4 sheet
// (Owner 2026-11-16: no dark palette), and the body font.
export function LegalFrame({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div data-palette="light" className={`bg-layer-default font-body text-fg-neutral ${className}`}>
      {children}
    </div>
  );
}
