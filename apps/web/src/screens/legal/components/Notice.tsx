import type { ReactNode } from 'react';

// A notice block set apart from the running text by a weak brand face, a side rule and a bold label,
// not by color alone (G-LU4). The same block draws the body's callouts and the screen's own notices.
// Tones share one face: the label carries the difference (Owner 2026-11-16, no state color token yet).
export function Notice({
  label,
  role,
  children,
  className = '',
}: {
  label: string;
  role?: 'note' | 'status';
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={role}
      className={`rounded-r-control border-l-4 border-brand-stroke bg-brand-weak px-4 py-3 text-body break-keep wrap-anywhere ${className}`}
    >
      <strong className="mr-2 font-bold">{label}</strong>
      {children}
    </div>
  );
}
