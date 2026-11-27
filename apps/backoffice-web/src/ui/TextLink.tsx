import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

/**
 * A link in the brand text color. It never prefetches: a prefetch would read the API and move the session's activity
 * (README §4). The caller adds its size and layout (`text-body`, an icon gap) with `className`.
 */
export function TextLink({
  href,
  className = '',
  children,
}: {
  readonly href: ComponentProps<typeof Link>['href'];
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`font-semibold text-fg-brand underline-offset-4 hover:underline focus-ring ${className}`}
    >
      {children}
    </Link>
  );
}
