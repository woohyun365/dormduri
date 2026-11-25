import type { ReactNode } from 'react';
import type { AccessRequest } from '@repo/shared/backoffice';

/** The five status meanings of the screens (design guide ⑥): waiting, in progress or neutral news, done, attention, failed. */
export type Meaning = 'pending' | 'info' | 'success' | 'warning' | 'danger';

const MEANING_TEXT: Record<Meaning, string> = {
  pending: 'text-fg-pending',
  info: 'text-fg-info',
  success: 'text-fg-success',
  warning: 'text-fg-warning',
  danger: 'text-fg-danger',
};

/** The meaning of each access request status. */
export const REQUEST_STATUS_MEANING: Record<AccessRequest['status'], Meaning> = {
  PENDING: 'pending',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'pending',
  EXPIRED: 'warning',
};

const AUDIT_RESULT_MEANING: Readonly<Record<string, Meaning>> = {
  SUCCEEDED: 'success',
  DENIED: 'warning',
  FAILED: 'danger',
};

/** The meaning of an audit row's result; an unknown result reads as neutral. */
export function auditResultMeaning(result: string): Meaning {
  return AUDIT_RESULT_MEANING[result] ?? 'pending';
}

/**
 * A status in words with its meaning's color and a dot (never the color alone), without a pill. It sits in a slot of
 * its own — a table column, a fixed column before a line, a card head's end, or a line of its own — never inside a
 * sentence, so it reads apart from the words around it.
 */
export function StatusBadge({
  meaning,
  children,
}: {
  readonly meaning: Meaning;
  readonly children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-label font-semibold whitespace-nowrap ${MEANING_TEXT[meaning]}`}
    >
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}
