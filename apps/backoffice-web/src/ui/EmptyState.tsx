import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';

/** An empty list or an empty filter result, said in words; the two read apart (design guide ⑥). */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  readonly icon: IconName;
  readonly title: string;
  readonly children?: ReactNode;
  readonly action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-stroke-neutral px-card py-10 text-center">
      <Icon name={icon} className="size-6 text-fg-muted" />
      <p className="text-body font-semibold text-fg-label">{title}</p>
      {children ? <p className="text-caption text-fg-muted">{children}</p> : null}
      {action}
    </div>
  );
}
