interface EmptyStateProps {
  icon?: React.ReactNode;
  message: string;
}

export function EmptyState({ icon, message }: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      {icon && (
        <div className="w-16 h-16 bg-[var(--knu-background-alt)] rounded-full flex items-center justify-center mx-auto mb-4">
          {icon}
        </div>
      )}
      <p className="text-[var(--knu-text-secondary)] text-sm">{message}</p>
    </div>
  );
}
