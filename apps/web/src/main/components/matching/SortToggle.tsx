'use client';

export type SortOption = 'matchScore' | 'oldest';

interface SortToggleProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export function SortToggle({ value, onChange }: SortToggleProps) {
  const checked = value === 'matchScore';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="받은 요청을 매칭도 우선으로 정렬"
      onClick={() => onChange(checked ? 'oldest' : 'matchScore')}
      className="group inline-flex items-center gap-3 rounded-lg px-1 py-1 text-right transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--knu-primary)]/25"
    >
      <span className="text-[12px] font-semibold leading-none text-[var(--knu-text-primary)]">
        {checked ? '매칭도순' : '도착순'}
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? 'bg-[var(--knu-primary)]' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}
