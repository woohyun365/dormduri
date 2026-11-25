import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

// Form fields: a real <label> above the control and an optional hint the control describes itself with (role and label
// queries, axe). The control boundary keeps 3:1 against the card (WCAG 2.2 SC 1.4.11).
const CONTROL =
  'w-full rounded-control border border-stroke-control bg-layer-default px-control-x py-control-y text-body text-fg-neutral focus-ring';

function FieldFrame({
  id,
  label,
  hint,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label font-semibold text-fg-label">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-caption text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  id,
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
}) {
  return (
    <FieldFrame id={id} label={label} hint={hint}>
      <input
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={CONTROL}
        {...props}
      />
    </FieldFrame>
  );
}

export function TextAreaField({
  id,
  label,
  hint,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
}) {
  return (
    <FieldFrame id={id} label={label} hint={hint}>
      <textarea
        id={id}
        rows={3}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={CONTROL}
        {...props}
      />
    </FieldFrame>
  );
}

export function SelectField({
  id,
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { readonly id: string; readonly label: string }) {
  return (
    <FieldFrame id={id} label={label}>
      <select id={id} className={CONTROL} {...props}>
        {children}
      </select>
    </FieldFrame>
  );
}
