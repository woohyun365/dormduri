interface FieldErrorProps {
  message?: string;
}

export function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;

  return (
    <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
      <span className="w-1 h-1 bg-red-600 rounded-full"></span>
      {message}
    </p>
  );
}
