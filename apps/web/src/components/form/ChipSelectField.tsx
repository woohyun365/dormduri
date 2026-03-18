'use client';

import { useId } from 'react';
import { Chip } from '@/components/Chip';
import { FieldError } from '@/components/form/FieldError';

interface ChipSelectFieldProps {
  label: string;
  options: Record<string, string>;
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
  required?: boolean;
  allowDeselect?: boolean;
  helperText?: string;
}

export function ChipSelectField({
  label,
  options,
  value,
  onChange,
  error,
  required = false,
  allowDeselect = false,
  helperText,
}: ChipSelectFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  const handleClick = (optionValue: string) => {
    if (allowDeselect && value === optionValue) {
      onChange(null);
    } else {
      onChange(optionValue);
    }
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-[var(--knu-text-primary)] mb-3">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={label}
        aria-describedby={error ? errorId : undefined}
      >
        {Object.entries(options).map(([optValue, optLabel]) => (
          <Chip
            key={optValue}
            label={optLabel}
            selected={value === optValue}
            onClick={() => handleClick(optValue)}
          />
        ))}
      </div>
      {helperText && <p className="text-xs text-[var(--knu-text-tertiary)] mt-1.5">{helperText}</p>}
      <FieldError message={error} id={errorId} />
    </div>
  );
}
