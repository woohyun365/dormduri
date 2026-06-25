interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'badge';
  role?: string;
  'aria-checked'?: boolean;
}

export function Chip({
  label,
  selected = false,
  onClick,
  variant = 'default',
  role: roleProp,
  'aria-checked': ariaChecked,
}: ChipProps) {
  if (variant === 'badge') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      role={roleProp}
      aria-pressed={roleProp ? undefined : selected}
      aria-checked={ariaChecked}
      className={`px-5 h-11 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
        selected
          ? 'bg-(--knu-primary) text-white shadow-sm'
          : 'bg-(--knu-background-alt) text-(--knu-text-secondary) hover:bg-gray-200 active:bg-gray-300'
      }`}
    >
      {label}
    </button>
  );
}
