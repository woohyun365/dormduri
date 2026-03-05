interface FieldErrorProps {
  message?: string;
  id?: string;
}

export function FieldError({ message, id }: FieldErrorProps) {
  if (!message) return null;

  return (
    <p
      id={id}
      role="alert"
      className="text-sm text-red-600 mt-2 flex items-center gap-1"
    >
      <span className="w-1 h-1 bg-red-600 rounded-full"></span>
      {message}
    </p>
  );
}
