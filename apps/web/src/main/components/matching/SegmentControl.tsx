'use client';

interface SegmentOption {
  id: string;
  label: string;
  badge?: number;
}

interface SegmentControlProps {
  options: SegmentOption[];
  selected: string;
  onChange: (id: string) => void;
}

export function SegmentControl({ options, selected, onChange }: SegmentControlProps) {
  return (
    <div className="bg-[var(--knu-background-alt)] rounded-xl p-1 flex gap-1 border-2 border-[var(--knu-border)]">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all relative ${
            selected === option.id
              ? 'bg-white text-[var(--knu-primary)] shadow-sm'
              : 'text-[var(--knu-text-secondary)] hover:text-[var(--knu-text-primary)]'
          }`}
        >
          {option.label}
          {option.badge !== undefined && option.badge > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {option.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
