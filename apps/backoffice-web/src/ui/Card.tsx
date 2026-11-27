import type { ReactNode } from 'react';

/**
 * A section of a page: a bordered white card with an optional title (h2) and an action at its head's end. A `flush`
 * card lets a table run to its edges.
 */
export function Card({
  id,
  title,
  action,
  flush = false,
  className = '',
  children,
}: {
  readonly id: string;
  readonly title?: string;
  readonly action?: ReactNode;
  readonly flush?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={title ? `${id}-heading` : undefined}
      className={`flex min-w-0 flex-col rounded-card border border-stroke-subtle bg-layer-default ${className}`}
    >
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-card pt-card">
          <h2 id={`${id}-heading`} className="text-title-2 font-semibold text-fg-neutral">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      <div className={flush ? 'pt-stack' : 'flex flex-col gap-4 p-card'}>{children}</div>
    </section>
  );
}
