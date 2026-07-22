import type { ReactNode } from 'react';

export function CounterpartActionFooter({
  className = '',
  testId,
  children,
}: {
  readonly className?: string;
  readonly testId?: string;
  readonly children: ReactNode;
}) {
  return (
    <footer
      className={`mt-3 border-t border-(--knu-border) pt-3 ${className}`}
      data-testid={testId}
    >
      {children}
    </footer>
  );
}
