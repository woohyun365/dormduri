import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';

/** Small form parts shared by the screens. Labels are real <label>s (role·label queries, axe). */

export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`rounded-control bg-brand-solid px-4 py-2 text-body font-medium text-fg-on-brand hover:bg-brand-solid-hover disabled:cursor-not-allowed disabled:bg-brand-solid-disabled ${className}`}
      {...props}
    />
  );
}

export function SecondaryButton({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`rounded-control border border-stroke-neutral bg-layer-default px-4 py-2 text-body font-medium text-fg-neutral hover:bg-layer-muted disabled:cursor-not-allowed disabled:text-fg-disabled ${className}`}
      {...props}
    />
  );
}

export function TextField({
  label,
  hint,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  readonly label: string;
  readonly hint?: string;
  readonly id: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-body font-medium text-fg-label">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="rounded-control border border-stroke-neutral px-3 py-2 text-body text-fg-neutral"
        {...props}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-caption text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  readonly label: string;
  readonly hint?: string;
  readonly id: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-body font-medium text-fg-label">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="rounded-control border border-stroke-neutral px-3 py-2 text-body text-fg-neutral"
        {...props}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-caption text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Result of an action: `alert` for a failure, `status` for a success. */
export function FormMessage({
  tone,
  children,
}: {
  readonly tone: 'error' | 'success';
  readonly children: ReactNode;
}) {
  return tone === 'error' ? (
    <p role="alert" className="rounded-box bg-danger-weak px-3 py-2 text-body text-fg-danger">
      {children}
    </p>
  ) : (
    <p role="status" className="rounded-box bg-success-weak px-3 py-2 text-body text-fg-success">
      {children}
    </p>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="flex flex-col gap-4 rounded-card border border-stroke-subtle bg-layer-default p-6"
    >
      <h2 id={`${id}-heading`} className="text-title-3 font-semibold text-fg-neutral">
        {title}
      </h2>
      {children}
    </section>
  );
}
