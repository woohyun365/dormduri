'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputFieldProps {
  label: string;
  type?: 'text' | 'email' | 'password' | 'number';
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helper?: string;
  disabled?: boolean;
  maxLength?: number;
}

export function InputField({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  helper,
  disabled = false,
  maxLength,
}: InputFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const inputType = type === 'password' && showPassword ? 'text' : type;

  return (
    <div className="w-full">
      <label className="block text-sm font-semibold text-[var(--knu-text-primary)] mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          maxLength={maxLength}
          className={`w-full h-12 px-4 rounded-xl border-2 transition-all ${
            error
              ? 'border-red-300 bg-red-50 focus:border-red-500'
              : 'border-[var(--knu-border)] bg-white focus:border-[var(--knu-primary)]'
          } ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''} outline-none`}
        />
        {type === 'password' && (
          <button
            type="button"
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
      {error && (
        <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
          <span className="w-1 h-1 bg-red-600 rounded-full"></span>
          {error}
        </p>
      )}
      {helper && !error && <p className="text-sm text-[var(--knu-text-tertiary)] mt-2">{helper}</p>}
    </div>
  );
}
