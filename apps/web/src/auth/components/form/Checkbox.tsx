import { useId, type ReactNode } from 'react';
import { Check } from 'lucide-react';

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: ReactNode;
  required?: boolean;
  disabled?: boolean;
}

export function Checkbox({
  label,
  checked,
  onChange,
  description,
  required = false,
  disabled = false,
}: CheckboxProps) {
  const descriptionId = useId();

  return (
    <label
      className={`group flex items-stretch gap-3 ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      }`}
    >
      <div className="relative flex shrink-0 self-stretch items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          aria-label={label}
          aria-describedby={description ? descriptionId : undefined}
          className="sr-only peer"
        />
        <div
          className={`size-6 rounded-lg border-2 transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-(--knu-primary) peer-focus-visible:ring-offset-1 ${
            checked
              ? 'border-(--knu-primary) bg-(--knu-primary)'
              : 'border-(--knu-border) bg-white group-hover:border-(--knu-primary)'
          }`}
        >
          {checked && <Check className="size-full p-0.5 text-white" strokeWidth={3} />}
        </div>
      </div>
      <span className="min-w-0">
        <span
          className={`block text-sm text-(--knu-text-primary) ${
            description ? 'leading-4' : 'leading-5'
          }`}
        >
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </span>
        {description ? (
          <span
            id={descriptionId}
            className="block whitespace-nowrap text-xs leading-4 text-(--knu-text-tertiary)"
          >
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
