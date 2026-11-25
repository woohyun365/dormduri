import type { ReactNode } from 'react';

/** A table that scrolls inside its own region on a narrow screen (the page itself does not scroll sideways). */
export function TableRegion({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    // A keyboard user can scroll the region: it takes focus (axe scrollable-region-focusable). `relative` keeps the
    // absolutely placed sr-only header text inside the region, or it widens the page on a narrow screen.
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="relative overflow-x-auto focus-ring"
    >
      {children}
    </div>
  );
}

/**
 * Header and body cell classes. A header stays on one line, except from 1024px to 1279px where the tables give up their
 * minimum width and long headers wrap at spaces.
 */
export const TH =
  'bg-layer-muted px-cell-x py-cell-y text-left text-label font-semibold whitespace-nowrap text-fg-muted lg:max-xl:whitespace-normal';
export const TD = 'px-cell-x py-cell-y text-table text-fg-neutral';
