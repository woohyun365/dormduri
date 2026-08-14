import type { ReactNode } from 'react';

export function MatchingTabLayout({
  children,
  busy = false,
  width = 'compact',
}: {
  readonly children: ReactNode;
  readonly busy?: boolean;
  readonly width?: 'compact' | 'archive';
}) {
  return (
    <section
      aria-labelledby="matching-tab-heading"
      aria-busy={busy || undefined}
      data-testid="matching-tab-layout"
      className={`mx-auto w-full overflow-x-clip px-5 py-5 ${
        width === 'archive' ? 'max-w-md md:max-w-5xl' : 'max-w-md'
      }`}
    >
      <div className="min-w-0" data-testid="matching-tab-primary">
        {children}
      </div>
    </section>
  );
}
