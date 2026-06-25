interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  message: string;
  action?: EmptyStateAction;
}

export function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      {icon && (
        <div className="w-16 h-16 bg-(--knu-background-alt) rounded-full flex items-center justify-center mx-auto mb-4">
          {icon}
        </div>
      )}
      <p className="text-(--knu-text-secondary) text-sm">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 text-sm font-semibold text-(--knu-primary) bg-(--knu-primary-light) rounded-xl"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
