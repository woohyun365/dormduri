import { Check } from 'lucide-react';

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
}

export function Checkbox({ label, checked, onChange, required = false }: CheckboxProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div
          className={`w-6 h-6 rounded-lg border-2 transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--knu-primary)] peer-focus-visible:ring-offset-1 ${
            checked
              ? 'bg-[var(--knu-primary)] border-[var(--knu-primary)]'
              : 'bg-white border-[var(--knu-border)] group-hover:border-[var(--knu-primary)]'
          }`}
        >
          {checked && <Check className="w-full h-full text-white p-0.5" strokeWidth={3} />}
        </div>
      </div>
      <span className="text-sm text-[var(--knu-text-primary)] leading-relaxed">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </span>
    </label>
  );
}
