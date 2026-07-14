import type { ReactNode } from 'react';

export function MatchingTabLayout({
  children,
  rail,
}: {
  readonly children: ReactNode;
  readonly rail?: ReactNode;
}) {
  return (
    <main className="mx-auto grid max-w-5xl gap-4 p-4 md:grid-cols-[minmax(0,1fr)_16rem]">
      <section className="min-w-0">{children}</section>
      {rail && <aside className="hidden md:block">{rail}</aside>}
    </main>
  );
}
