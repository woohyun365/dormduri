import type { ReactNode } from 'react';

/** The page title (the page's one h1), a short count line and one primary action (design guide ⑥). */
export function PageHeader({
  title,
  meta,
  actions,
}: {
  readonly title: string;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-title-1 font-bold text-fg-neutral">{title}</h1>
        {meta ? <p className="text-body text-fg-muted">{meta}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
