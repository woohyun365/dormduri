import type { ReactNode } from 'react';

export function MatchingTabLayout({
  header,
  children,
  rail,
  busy = false,
}: {
  readonly header: ReactNode;
  readonly children: ReactNode;
  readonly rail: ReactNode;
  readonly busy?: boolean;
}) {
  return (
    <section
      aria-labelledby="matching-tab-heading"
      aria-busy={busy || undefined}
      data-testid="matching-tab-layout"
      className="mx-auto grid w-full max-w-[1152px] grid-cols-1 gap-5 overflow-x-clip px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,720px)_320px] lg:justify-center lg:gap-6 lg:px-8 lg:py-8"
    >
      <div className="min-w-0 lg:col-span-2">{header}</div>
      <div className="min-w-0" data-testid="matching-tab-primary">
        {children}
      </div>
      <aside aria-label="매칭 이용 안내" className="min-w-0" data-testid="matching-policy-rail">
        <div className="lg:sticky lg:top-6">{rail}</div>
      </aside>
    </section>
  );
}
