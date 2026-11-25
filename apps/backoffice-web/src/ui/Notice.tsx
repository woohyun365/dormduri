import type { ReactNode, Ref } from 'react';

const TONES = {
  warning: 'border-stroke-warning bg-warning-weak text-fg-warning',
  info: 'border-stroke-info bg-info-weak text-fg-info',
  danger: 'border-stroke-danger bg-danger-weak text-fg-danger',
  success: 'border-stroke-success bg-success-weak text-fg-success',
} as const;

export type NoticeTone = keyof typeof TONES;

/**
 * A result or a notice in words, in place near the action it reports (design guide ⑥: no toast). `role` says how it is
 * read: `alert` for a failure or an ended session, `status` for a success or a quiet notice. A screen can hand it focus
 * (`focusRef`) when the control that started the action is gone after it.
 */
export function Notice({
  tone,
  role,
  focusRef,
  children,
}: {
  readonly tone: NoticeTone;
  readonly role: 'status' | 'alert';
  readonly focusRef?: Ref<HTMLDivElement>;
  readonly children: ReactNode;
}) {
  return (
    <div
      ref={focusRef}
      role={role}
      tabIndex={focusRef ? -1 : undefined}
      className={`rounded-card border px-4 py-3 text-body ${TONES[tone]} ${focusRef ? 'focus-ring' : ''}`}
    >
      {children}
    </div>
  );
}
