'use client';

import type { InputHTMLAttributes } from 'react';
import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Field, FieldControl, FieldLabel, FieldMessage } from './Field';

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
  reserveMessageSpace?: boolean;
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
    reserveMessageSpace = false,
  },
  ref,
) {
  const id = useId();
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const [showPassword, setShowPassword] = useState(false);
  const inputType = type === 'password' && showPassword ? 'text' : type;
  const describedById = error ? errorId : helper ? helperId : undefined;
  const shouldRenderMessageArea = reserveMessageSpace || Boolean(error) || Boolean(helper);

  return (
    <Field invalid={Boolean(error)} className="w-full">
      <FieldLabel
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-(--knu-text-primary)"
      >
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </FieldLabel>
      <FieldControl className="relative">
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
          aria-describedby={describedById}
          data-slot="input"
          className={`h-12 w-full rounded-xl border-2 px-4 outline-none transition-[border-color,background-color,box-shadow] focus-visible:ring-3 focus-visible:ring-indigo-100 ${
            error
              ? 'border-red-300 bg-red-50 focus-visible:border-red-500 focus-visible:ring-red-100'
              : 'border-(--knu-border) bg-white focus-visible:border-(--knu-primary)'
          } ${type === 'password' ? 'pr-12' : ''} ${
            disabled ? 'cursor-not-allowed bg-gray-100 text-gray-500' : ''
          }`}
        />
        {type === 'password' && (
          <button
            type="button"
            aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
            onClick={() => setShowPassword(!showPassword)}
            disabled={disabled}
            className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
          >
            {showPassword ? (
              <EyeOff className="size-5 text-(--knu-text-tertiary)" />
            ) : (
              <Eye className="size-5 text-(--knu-text-tertiary)" />
            )}
          </button>
        )}
      </FieldControl>
      {shouldRenderMessageArea && (
        <FieldMessage
          error={error}
          errorId={errorId}
          descriptionId={helperId}
          reserveSpace={reserveMessageSpace}
        >
          {helper}
        </FieldMessage>
      )}
    </Field>
  );
});
