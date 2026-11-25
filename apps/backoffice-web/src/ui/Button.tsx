import type { ButtonHTMLAttributes } from 'react';

// Quiet buttons (secondary, danger) are filled without a border; the solid red is only the last action of a risky
// confirmation (design guide ⑥).
const TONES = {
  primary: 'bg-brand-solid text-fg-on-brand hover:bg-brand-solid-hover',
  secondary: 'bg-tint-neutral text-fg-neutral hover:bg-tint-neutral-hover',
  danger: 'bg-danger-weak text-fg-danger hover:bg-tint-danger-hover',
  /** The one action of a risky confirmation. */
  'danger-solid': 'bg-danger-solid text-fg-on-brand hover:bg-danger-solid-hover',
} as const;

export type ButtonTone = keyof typeof TONES;

/**
 * Every button of the screens. A small one is 32px tall at every width; a medium one is 40px, 32px below 1024px where the
 * control spacing and the body line shrink (design guide ⑥). A long label may wrap at spaces
 * (`wrap`, a 320px reflow); short labels stay on one line. A button that cannot act yet (busy) keeps its tone, dimmed.
 */
export function Button({
  tone = 'primary',
  size = 'md',
  wrap = false,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly tone?: ButtonTone;
  readonly size?: 'md' | 'sm';
  readonly wrap?: boolean;
}) {
  const pad =
    size === 'sm' ? 'min-h-8 px-3 py-1.5 text-label' : 'px-control-x py-control-y text-body';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-control font-semibold ${wrap ? 'text-left' : 'whitespace-nowrap'} disabled:cursor-not-allowed disabled:opacity-60 ${pad} ${TONES[tone]} focus-ring ${className}`}
      {...props}
    />
  );
}
