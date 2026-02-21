interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'badge';
}

export function Chip({ label, selected = false, onClick, variant = 'default' }: ChipProps) {
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
      className={`px-5 h-11 rounded-full font-medium text-sm transition-all ${
        selected
          ? 'bg-blue-500 text-white shadow-sm'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
      }`}
    >
      {label}
    </button>
  );
}
