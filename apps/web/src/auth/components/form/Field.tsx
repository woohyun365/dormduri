import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { FieldError } from './FieldError';

interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  invalid?: boolean;
}

export const Field = forwardRef<HTMLDivElement, FieldProps>(function Field(
  { invalid = false, className = '', ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="field"
      data-invalid={invalid ? 'true' : undefined}
      className={className}
      {...props}
    />
  );
});

export function FieldGroup({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="field-group" className={className} {...props} />;
}

export function FieldControl({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="field-control" className={className} {...props} />;
}

export function FieldLabel({ className = '', ...props }: ComponentPropsWithoutRef<'label'>) {
  return <label data-slot="field-label" className={className} {...props} />;
}

export function FieldDescription({ className = '', ...props }: ComponentPropsWithoutRef<'p'>) {
  return <p data-slot="field-description" className={className} {...props} />;
}

interface FieldMessageProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  error?: string;
  errorId?: string;
  descriptionId?: string;
  descriptionClassName?: string;
  reserveSpace?: boolean;
  children?: ReactNode;
}

export function FieldMessage({
  error,
  errorId,
  descriptionId,
  descriptionClassName = '',
  reserveSpace = false,
  children,
  className = '',
  ...props
}: FieldMessageProps) {
  if (!reserveSpace && !error && !children) return null;

  return (
    <div
      data-slot="field-message"
      className={`${reserveSpace ? 'min-h-6 pt-1' : ''} ${className}`.trim()}
      {...props}
    >
      {error ? (
        <FieldError message={error} id={errorId} className={reserveSpace ? 'mt-0' : ''} />
      ) : children ? (
        <p
          id={descriptionId}
          className={`text-sm leading-5 text-(--knu-text-tertiary) ${reserveSpace ? '' : 'mt-2'} ${descriptionClassName}`.trim()}
        >
          {children}
        </p>
      ) : null}
    </div>
  );
}
