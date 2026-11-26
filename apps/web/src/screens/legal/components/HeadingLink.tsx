'use client';

import type { ReactNode } from 'react';
import { jumpToHeading } from './jumpToHeading';

// A link to a heading on this page that moves like a table-of-contents entry: no history entry, the
// heading takes focus, a modified click is left to the browser (jumpToHeading).
export function HeadingLink({
  targetId,
  className,
  children,
}: {
  targetId: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <a
      href={`#${targetId}`}
      onClick={(event) => jumpToHeading(event, targetId)}
      className={className}
    >
      {children}
    </a>
  );
}
