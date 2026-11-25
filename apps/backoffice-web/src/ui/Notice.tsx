import type { ReactNode } from 'react';

const TONES = {
  warning: 'border-stroke-warning bg-warning-weak text-fg-warning',
  info: 'border-stroke-info bg-info-weak text-fg-info',
  danger: 'border-stroke-danger bg-danger-weak text-fg-danger',
  success: 'border-stroke-success bg-success-weak text-fg-success',
} as const;

export type NoticeTone = keyof typeof TONES;

/**
 * A result or a notice in words, in place near the action it reports (design guide ⑥: no toast). `role` says how it is
 * read: `alert` for a failure or an ended session, `status` for a success or a quiet notice.
 */
export function Notice({
  tone,
  role,
  children,
}: {
  readonly tone: NoticeTone;
  readonly role: 'status' | 'alert';
  readonly children: ReactNode;
}) {
  return (
    <div role={role} className={`rounded-card border px-4 py-3 text-body ${TONES[tone]}`}>
      {children}
    </div>
  );
}
