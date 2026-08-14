import type { KeyboardEvent, RefObject } from 'react';
import { useId } from 'react';
import { CheckCircle2, LoaderCircle, RotateCcw } from 'lucide-react';
import { DISPLAY_IDENTITY_NICKNAME_MAX_LENGTH } from '@repo/shared/user/identity';
import { Button } from '@/components/ui/Button';
import { Field, FieldControl, FieldLabel, FieldMessage } from '@/auth/components/form/Field';
import type { SignupNicknameValidationState } from '../../model/signup-nickname-validation.types';

interface NicknameValidationFieldProps {
  value: string;
  error: string;
  state: SignupNicknameValidationState;
  inputRef: RefObject<HTMLInputElement | null>;
  disabled: boolean;
  onChange: (value: string) => void;
  onCheck: () => void;
}

const STATUS_PRESENTATION = {
  checking: {
    Icon: LoaderCircle,
    className: 'text-sky-700',
    iconClassName: 'animate-spin',
  },
  available: {
    Icon: CheckCircle2,
    className: 'text-emerald-700',
    iconClassName: '',
  },
  stale: {
    Icon: RotateCcw,
    className: 'text-slate-600',
    iconClassName: '',
  },
} as const;

function getStatusPresentation(state: SignupNicknameValidationState) {
  switch (state.status) {
    case 'checking':
    case 'available':
    case 'stale':
      return STATUS_PRESENTATION[state.status];
    case 'unchecked':
    case 'rejected':
    case 'unavailable':
    case 'expired':
      return null;
  }
}

export function NicknameValidationField({
  value,
  error,
  state,
  inputRef,
  disabled,
  onChange,
  onCheck,
}: NicknameValidationFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const statusId = `${id}-status`;
  const validationError = error || (state.status === 'rejected' ? state.message : '');
  const status = getStatusPresentation(state);
  const statusMessage =
    state.status === 'checking'
      ? '닉네임을 확인하고 있어요.'
      : 'message' in state
        ? state.message
        : null;
  const describedBy = validationError
    ? errorId
    : state.status === 'unchecked'
      ? helperId
      : status
        ? statusId
        : undefined;
  const buttonLabel =
    state.status === 'checking'
      ? '확인 중...'
      : state.status === 'available'
        ? '확인 완료'
        : '중복 확인';

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!disabled && state.status !== 'checking' && state.status !== 'available') onCheck();
  };

  return (
    <Field invalid={Boolean(validationError)} className="w-full">
      <FieldLabel
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-(--knu-text-primary)"
      >
        닉네임<span className="ml-1 text-red-500">*</span>
      </FieldLabel>
      <FieldControl className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input
          ref={inputRef}
          id={id}
          name="nickname"
          type="text"
          autoComplete="nickname"
          placeholder="한글 또는 영문 2~8자"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          maxLength={DISPLAY_IDENTITY_NICKNAME_MAX_LENGTH}
          aria-invalid={Boolean(validationError)}
          aria-required="true"
          aria-describedby={describedBy}
          className={`h-12 min-w-0 rounded-xl border-2 px-3 outline-none transition-[border-color,background-color,box-shadow] focus-visible:ring-3 sm:px-4 ${
            validationError
              ? 'border-red-300 bg-red-50 focus-visible:border-red-500 focus-visible:ring-red-100'
              : state.status === 'available'
                ? 'border-emerald-300 bg-emerald-50/50 focus-visible:border-emerald-500 focus-visible:ring-emerald-100'
                : 'border-(--knu-border) bg-white focus-visible:border-(--knu-primary) focus-visible:ring-indigo-100'
          } ${disabled ? 'cursor-not-allowed bg-gray-100 text-gray-500' : ''}`}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-12 shrink-0 px-3 text-xs whitespace-nowrap sm:px-4 sm:text-sm"
          onClick={onCheck}
          disabled={disabled || state.status === 'checking' || state.status === 'available'}
          aria-describedby={describedBy}
        >
          {buttonLabel}
        </Button>
      </FieldControl>
      <FieldMessage error={validationError} errorId={errorId} descriptionId={helperId}>
        {state.status === 'unchecked' ? '한글·영문 2~8자, 숫자 조합 가능' : undefined}
      </FieldMessage>
      {status ? (
        <p
          id={statusId}
          role="status"
          aria-live="polite"
          className={`mt-2 flex items-center gap-1.5 text-sm font-medium leading-5 ${status.className}`}
        >
          <status.Icon className={`size-3.5 shrink-0 ${status.iconClassName}`} aria-hidden="true" />
          {statusMessage}
        </p>
      ) : null}
    </Field>
  );
}
