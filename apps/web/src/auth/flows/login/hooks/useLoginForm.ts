'use client';

import { useCallback, useMemo, useState } from 'react';
import { authApi } from '@/auth/api';
import { LOGIN_LOCKOUT_SECONDS } from '@repo/shared/auth/policy';
import { useAuthCountdown } from '@/auth/hooks';
import {
  hasLoginFieldErrors,
  INITIAL_LOGIN_FORM_VALUES,
  validateLoginForm,
} from '../model/login-form.validation';
import {
  mapLoginResponseToErrorState,
  mapLoginThrownErrorToErrorState,
} from '../model/login-result.mapper';
import { DEFAULT_LOGIN_REDIRECT_TARGET } from '../model/login-redirect-target';
import type {
  LoginFieldErrors,
  LoginFn,
  LoginFormSubmitEvent,
  LoginFormValues,
  LoginInvalidField,
  LoginRedirectState,
  LoginSuccessHandler,
  LoginUiErrorState,
} from '../model/login-form.types';

interface UseLoginFormOptions {
  onLogin?: LoginFn;
  onSuccess?: LoginSuccessHandler;
  redirectTarget?: string;
}

export interface UseLoginFormResult {
  values: LoginFormValues;
  fieldErrors: LoginFieldErrors;
  uiError: LoginUiErrorState | null;
  isSubmitting: boolean;
  redirectState: LoginRedirectState;
  isLocked: boolean;
  isThrottled: boolean;
  isSubmitDisabled: boolean;
  cooldownLabel: string;
  lastInvalidField: LoginInvalidField | null;
  invalidSubmitCount: number;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setRememberMe: (value: boolean) => void;
  handleSubmit: (event?: LoginFormSubmitEvent) => void;
}

export function useLoginForm({
  onLogin = authApi.login,
  onSuccess,
  redirectTarget = DEFAULT_LOGIN_REDIRECT_TARGET,
}: UseLoginFormOptions = {}): UseLoginFormResult {
  const [values, setValues] = useState<LoginFormValues>(INITIAL_LOGIN_FORM_VALUES);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [uiError, setUiError] = useState<LoginUiErrorState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redirectState, setRedirectState] = useState<LoginRedirectState>({
    isRedirecting: false,
    target: null,
  });
  const [lockedEmail, setLockedEmail] = useState('');
  const [lastInvalidField, setLastInvalidField] = useState<LoginInvalidField | null>(null);
  const [invalidSubmitCount, setInvalidSubmitCount] = useState(0);
  const {
    isActive: isCooldownActive,
    start: startCooldown,
    stop: stopCooldown,
    formatTime: formatCooldownTime,
  } = useAuthCountdown(LOGIN_LOCKOUT_SECONDS);

  const isLocked = uiError?.status === 'locked' && isCooldownActive && values.email === lockedEmail;
  const isThrottled = uiError?.status === 'throttled' && isCooldownActive;
  const isSubmitDisabled = isSubmitting || redirectState.isRedirecting || isLocked || isThrottled;

  const clearInteractionError = useCallback(() => {
    setUiError(null);
    setLockedEmail('');
    stopCooldown();
  }, [stopCooldown]);

  const setEmail = useCallback(
    (email: string) => {
      setValues((current) => ({ ...current, email }));
      setFieldErrors((current) => ({ ...current, email: undefined }));
      clearInteractionError();
    },
    [clearInteractionError],
  );

  const setPassword = useCallback(
    (password: string) => {
      setValues((current) => ({ ...current, password }));
      setFieldErrors((current) => ({ ...current, password: undefined }));
      clearInteractionError();
    },
    [clearInteractionError],
  );

  const setRememberMe = useCallback((rememberMe: boolean) => {
    setValues((current) => ({ ...current, rememberMe }));
  }, []);

  const submit = useCallback(async () => {
    if (isSubmitDisabled) return;

    const nextFieldErrors = validateLoginForm(values);
    setFieldErrors(nextFieldErrors);
    setUiError(null);

    if (hasLoginFieldErrors(nextFieldErrors)) {
      setLastInvalidField(nextFieldErrors.email ? 'email' : 'password');
      setInvalidSubmitCount((count) => count + 1);
      return;
    }

    setLastInvalidField(null);
    setIsSubmitting(true);
    try {
      const response = await onLogin(values.email, values.password, values.rememberMe);
      if (response.success) {
        stopCooldown();
        setRedirectState({ isRedirecting: true, target: redirectTarget });
        onSuccess?.(redirectTarget);
        return;
      }

      const nextUiError = mapLoginResponseToErrorState(response, values.email);
      setUiError(nextUiError);

      if (nextUiError?.status === 'locked' && nextUiError.remainingSeconds) {
        setLockedEmail(values.email);
        startCooldown(nextUiError.remainingSeconds);
      } else if (nextUiError?.status === 'throttled' && nextUiError.retryAfterSeconds) {
        startCooldown(nextUiError.retryAfterSeconds);
      }
    } catch {
      setUiError(mapLoginThrownErrorToErrorState());
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitDisabled, onLogin, onSuccess, redirectTarget, startCooldown, stopCooldown, values]);

  const handleSubmit = useCallback(
    (event?: LoginFormSubmitEvent) => {
      event?.preventDefault();
      void submit();
    },
    [submit],
  );

  return useMemo(
    () => ({
      values,
      fieldErrors,
      uiError,
      isSubmitting,
      redirectState,
      isLocked,
      isThrottled,
      isSubmitDisabled,
      cooldownLabel: formatCooldownTime(),
      lastInvalidField,
      invalidSubmitCount,
      setEmail,
      setPassword,
      setRememberMe,
      handleSubmit,
    }),
    [
      values,
      fieldErrors,
      uiError,
      isSubmitting,
      redirectState,
      isLocked,
      isThrottled,
      isSubmitDisabled,
      formatCooldownTime,
      lastInvalidField,
      invalidSubmitCount,
      setEmail,
      setPassword,
      setRememberMe,
      handleSubmit,
    ],
  );
}
