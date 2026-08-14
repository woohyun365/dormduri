import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/auth/components/form/Checkbox';
import { FieldGroup } from '@/auth/components/form/Field';
import { InputField } from '@/auth/components/form/InputField';
import { LoginPasswordResetAction } from './LoginSecondaryActions';
import { LoginStatusAlert } from './LoginStatusAlert';
import type {
  LoginFieldErrors,
  LoginFormSubmitEvent,
  LoginFormValues,
  LoginInvalidField,
  LoginUiErrorState,
} from '../model/login-form.types';

interface LoginFormProps {
  sessionNotice?: ReactNode;
  routeNotice?: ReactNode;
  values: LoginFormValues;
  fieldErrors: LoginFieldErrors;
  uiError: LoginUiErrorState | null;
  isSubmitting: boolean;
  isRedirecting: boolean;
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
  sessionNotice,
  routeNotice,
  values,
  fieldErrors,
  uiError,
  isSubmitting,
  isRedirecting,
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
  const rememberMeDescriptionId = useId();
  const isInteractionPending = isSubmitting || isRedirecting;

  useEffect(() => {
    if (invalidSubmitCount <= 0 || !lastInvalidField) return;

    const invalidInputRef = lastInvalidField === 'email' ? emailInputRef : passwordInputRef;
    invalidInputRef.current?.focus();
  }, [invalidSubmitCount, lastInvalidField]);

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-busy={isInteractionPending ? 'true' : undefined}
      className="-mx-5 mb-6 border-y border-(--knu-border) bg-white p-5 sm:mx-0 sm:rounded-2xl sm:border sm:p-6 sm:shadow-sm md:p-8"
    >
      <header data-testid="login-card-header" data-slot="card-header" className="mb-7 text-center">
        <h1 id="login-title" className="text-3xl font-bold text-(--knu-text-primary) md:text-4xl">
          로그인
        </h1>
        <p className="mt-3 keep-all text-sm leading-6 text-(--knu-text-secondary)">
          가입한 학교 이메일로 접속해요.
        </p>
      </header>

      {sessionNotice}
      {routeNotice}
      <LoginStatusAlert error={uiError} cooldownLabel={cooldownLabel} />

      <FieldGroup data-testid="login-field-group" className="space-y-2">
        {isInteractionPending && (
          <p className="sr-only" role="status" aria-live="polite">
            {isRedirecting ? '로그인이 완료되어 홈으로 이동 중입니다.' : '로그인 중입니다.'}
          </p>
        )}
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
          disabled={isInteractionPending}
          reserveMessageSpace
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
          disabled={isInteractionPending}
          reserveMessageSpace
        />

        <div className="pt-1">
          <div
            data-testid="login-secondary-actions"
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3"
          >
            <Checkbox
              label="로그인 유지(최대 7일)"
              ariaDescribedBy={rememberMeDescriptionId}
              size="sm"
              checked={values.rememberMe}
              onChange={onRememberMeChange}
              disabled={isInteractionPending}
            />
            <LoginPasswordResetAction
              onClick={onPasswordResetClick}
              disabled={isInteractionPending}
            />
            <p
              id={rememberMeDescriptionId}
              className="col-span-2 mt-0.5 pl-8 text-xs leading-4 text-(--knu-text-tertiary)"
            >
              개인 기기에서만 권장해요
            </p>
          </div>
        </div>

        <div className="pt-2">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            type="submit"
            disabled={isSubmitDisabled}
            aria-busy={isInteractionPending ? 'true' : undefined}
          >
            <Lock className="h-5 w-5" />
            {isRedirecting
              ? '홈으로 이동 중...'
              : isSubmitting
                ? '로그인 중...'
                : isLocked
                  ? '계정 잠금 중'
                  : '로그인'}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
