interface FieldErrorProps {
  message?: string;
  id?: string;
  className?: string;
}

export function FieldError({ message, id, className = '' }: FieldErrorProps) {
  if (!message) return null;

  return (
    <p
      id={id}
      role="alert"
      className={`mt-2 flex items-center gap-1 text-sm leading-5 text-red-600 ${className}`.trim()}
    >
      <span className="size-1 rounded-full bg-red-600" aria-hidden="true" />
      {message}
    </p>
  );
}
