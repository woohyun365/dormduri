'use client';

import type { InputHTMLAttributes } from 'react';
import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { FieldError } from './FieldError';

interface InputFieldProps {
  label: string;
  name?: string;
  type?: 'text' | 'email' | 'password' | 'number';
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helper?: string;
  disabled?: boolean;
  maxLength?: number;
  required?: boolean;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  {
    label,
    name,
    type = 'text',
    inputMode,
    autoComplete,
    placeholder,
    value,
    onChange,
    error,
    helper,
    disabled = false,
    maxLength,
    required = false,
  },
  ref,
) {
  const id = useId();
  const errorId = `${id}-error`;
  const [showPassword, setShowPassword] = useState(false);
  const inputType = type === 'password' && showPassword ? 'text' : type;

  return (
    <div className="w-full">
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-[var(--knu-text-primary)] mb-2"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          name={name}
          type={inputType}
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          maxLength={maxLength}
          aria-invalid={!!error}
          aria-required={required || undefined}
          aria-describedby={error ? errorId : undefined}
          className={`w-full h-12 px-4 rounded-xl border-2 transition-all ${
            error
              ? 'border-red-300 bg-red-50 focus:border-red-500'
              : 'border-[var(--knu-border)] bg-white focus:border-[var(--knu-primary)]'
          } ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''} outline-none`}
        />
        {type === 'password' && (
          <button
            type="button"
            aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
            ) : (
              <Eye className="w-5 h-5 text-[var(--knu-text-tertiary)]" />
            )}
          </button>
        )}
      </div>
      <FieldError message={error} id={errorId} />
      {helper && !error && <p className="text-sm text-[var(--knu-text-tertiary)] mt-2">{helper}</p>}
    </div>
  );
});
