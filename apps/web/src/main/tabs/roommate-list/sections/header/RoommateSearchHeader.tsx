import type { ReactNode } from 'react';

interface RoommateSearchHeaderProps {
  readonly title: string;
  readonly description: string;
  readonly statusMessage: string | null;
  readonly showRuntimeMessages: boolean;
  readonly children?: ReactNode;
}

export function RoommateSearchHeader({
  title,
  description,
  statusMessage,
  showRuntimeMessages,
  children,
}: RoommateSearchHeaderProps) {
  return (
    <section
      role="banner"
      className="sticky top-0 z-40 border-b-2 border-(--knu-border) bg-white/95 px-5 py-4 backdrop-blur"
    >
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.42fr)] lg:items-end">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-(--knu-primary)">Roommate Search</p>
            <h1 className="text-2xl font-bold text-(--knu-text-primary) md:text-3xl">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-(--knu-text-secondary)">
              {description}
            </p>
          </div>

          {showRuntimeMessages && statusMessage ? (
            <p
              role="status"
              className="rounded-2xl bg-(--knu-primary-light) px-4 py-3 text-sm font-semibold text-(--knu-primary)"
            >
              {statusMessage}
            </p>
          ) : null}
        </div>

        {children ? <div className="lg:justify-self-end lg:self-start">{children}</div> : null}
      </div>
    </section>
  );
}
