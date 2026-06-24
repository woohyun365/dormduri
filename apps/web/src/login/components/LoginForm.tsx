import { useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/form/Checkbox';
import { InputField } from '@/components/form/InputField';
import { LoginPasswordResetAction } from './LoginSecondaryActions';
import { LoginRememberMeHint } from './LoginRememberMeHint';
import { LoginStatusAlert } from './LoginStatusAlert';
import type {
  LoginFieldErrors,
  LoginFormSubmitEvent,
  LoginFormValues,
  LoginInvalidField,
  LoginUiErrorState,
} from '../model/login-form.types';

interface LoginFormProps {
  values: LoginFormValues;
  fieldErrors: LoginFieldErrors;
  uiError: LoginUiErrorState | null;
  isSubmitting: boolean;
  isLocked: boolean;
  isSubmitDisabled: boolean;
  cooldownLabel: string;
  lastInvalidField: LoginInvalidField | null;
  invalidSubmitCount: number;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberMeChange: (value: boolean) => void;
  onPasswordResetClick: () => void;
  onSubmit: (event: LoginFormSubmitEvent) => void;
}

export function LoginForm({
  values,
  fieldErrors,
  uiError,
  isSubmitting,
  isLocked,
  isSubmitDisabled,
  cooldownLabel,
  lastInvalidField,
  invalidSubmitCount,
  onEmailChange,
  onPasswordChange,
  onRememberMeChange,
  onPasswordResetClick,
  onSubmit,
}: LoginFormProps) {
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (invalidSubmitCount <= 0 || !lastInvalidField) return;

    const invalidInputRef = lastInvalidField === 'email' ? emailInputRef : passwordInputRef;
    invalidInputRef.current?.focus();
  }, [invalidSubmitCount, lastInvalidField]);

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mb-6 rounded-2xl border-2 border-[var(--knu-border)] bg-white p-6 shadow-sm md:p-8"
    >
      <LoginStatusAlert error={uiError} cooldownLabel={cooldownLabel} />

      <div className="space-y-5">
        <InputField
          ref={emailInputRef}
          label="이메일"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="example@kangwon.ac.kr"
          value={values.email}
          onChange={onEmailChange}
          error={fieldErrors.email}
          disabled={isSubmitting}
        />

        <InputField
          ref={passwordInputRef}
          label="비밀번호"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호를 입력해주세요"
          value={values.password}
          onChange={onPasswordChange}
          error={fieldErrors.password}
          disabled={isSubmitting}
        />

        <div>
          <div className="flex items-center justify-between">
            <Checkbox
              label="로그인 유지(최대 7일)"
              checked={values.rememberMe}
              onChange={onRememberMeChange}
            />
            <LoginPasswordResetAction onClick={onPasswordResetClick} />
          </div>
          <LoginRememberMeHint visible={values.rememberMe} />
        </div>

        <div className="pt-2">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            type="submit"
            disabled={isSubmitDisabled}
            aria-busy={isSubmitting ? 'true' : undefined}
          >
            <Lock className="h-5 w-5" />
            {isSubmitting ? '로그인 중...' : isLocked ? '계정 잠금 중' : '로그인'}
          </Button>
        </div>
      </div>
    </form>
  );
}
