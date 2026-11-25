import Link from 'next/link';
import type { ComponentProps } from 'react';

export type StatusFilterItem = {
  readonly key: string;
  readonly label: string;
  readonly href: ComponentProps<typeof Link>['href'];
  readonly current: boolean;
};

/**
 * Status filter links of a list: the filter is the URL query (a link, not screen state), the current one is
 * `aria-current="page"`, and no link prefetches (README §4).
 */
export function StatusFilter({
  label,
  items,
}: {
  readonly label: string;
  readonly items: readonly StatusFilterItem[];
}) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-1 rounded-control border border-stroke-subtle bg-layer-muted p-1">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              prefetch={false}
              aria-current={item.current ? 'page' : undefined}
              className={`block rounded-control px-3 py-1 text-label font-semibold ${
                item.current
                  ? 'border border-stroke-subtle bg-layer-default text-fg-neutral'
                  : 'text-fg-muted hover:text-fg-neutral'
              } focus-ring`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
