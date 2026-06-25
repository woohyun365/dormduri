import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/auth/api';
import {
  initialPasswordResetFlowState,
  passwordResetFlowReducer,
} from '../model/password-reset-flow.reducer';
import type {
  PasswordResetActionResult,
  PasswordResetStatus,
} from '../model/password-reset-flow.types';
import {
  createPasswordResetRetryAfterMessage,
  PASSWORD_RESET_COPY,
} from '../model/password-reset-copy';
import {
  isPasswordResetRestartRequired,
  normalizeRetryAfterSeconds,
} from '../model/password-reset-error.mapper';
import { usePasswordResetCooldown } from './usePasswordResetCooldown';
import { usePasswordResetSessionNotice } from './usePasswordResetSessionNotice';

export function usePasswordResetFlow() {
  const router = useRouter();
  const [state, dispatch] = useReducer(passwordResetFlowReducer, initialPasswordResetFlowState);
  const [status, setStatus] = useState<PasswordResetStatus | null>(null);
  const { isAuthenticated } = usePasswordResetSessionNotice();
  const cooldown = usePasswordResetCooldown();
  const retryAfter = usePasswordResetCooldown(0);
  const verificationStepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendRequestIdRef = useRef(0);

  const visibleStatus = useMemo<PasswordResetStatus | null>(() => {
    if (!status?.isRetryAfter) return status;
    if (!retryAfter.isActive) return null;

    return {
      ...status,
      message: createPasswordResetRetryAfterMessage(retryAfter.countdown),
    };
  }, [retryAfter.countdown, retryAfter.isActive, status]);

  const startRetryAfterStatus = useCallback(
    (seconds: number | undefined, title = PASSWORD_RESET_COPY.status.retryAfterTitle): boolean => {
      const normalizedSeconds = normalizeRetryAfterSeconds(seconds);
      if (!normalizedSeconds) return false;

      retryAfter.start(normalizedSeconds);
      setStatus({
        variant: 'warning',
        title,
        message: createPasswordResetRetryAfterMessage(normalizedSeconds),
        isRetryAfter: true,
      });
      return true;
    },
    [retryAfter],
  );

  const clearRetryAfterStatus = useCallback(() => {
    retryAfter.stop();
    setStatus((current) => (current?.isRetryAfter ? null : current));
  }, [retryAfter]);

  const clearVerificationStepTimeout = useCallback(() => {
    if (verificationStepTimeoutRef.current) {
      clearTimeout(verificationStepTimeoutRef.current);
      verificationStepTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearVerificationStepTimeout();
    };
  }, [clearVerificationStepTimeout]);

  const restartEmailEntry = useCallback(() => {
    sendRequestIdRef.current += 1;
    clearVerificationStepTimeout();
    cooldown.stop();
    clearRetryAfterStatus();
    setStatus(null);
    dispatch({ type: 'restartEmailEntry' });
  }, [clearRetryAfterStatus, clearVerificationStepTimeout, cooldown]);

  const changeEmail = useCallback(
    (email: string) => {
      sendRequestIdRef.current += 1;
      clearVerificationStepTimeout();
      cooldown.stop();
      clearRetryAfterStatus();
      setStatus(null);
      dispatch({ type: 'emailChanged', email });
    },
    [clearRetryAfterStatus, clearVerificationStepTimeout, cooldown],
  );

  const sendCode = useCallback(async () => {
    if (state.isSendingCode || cooldown.isActive || retryAfter.isActive) return;

    const requestEmail = state.email.trim();
    const requestId = ++sendRequestIdRef.current;
    setStatus(null);
    dispatch({ type: 'sendCodeStarted' });

    try {
      const result = await authApi.sendResetCode(requestEmail);
      if (requestId !== sendRequestIdRef.current) return;

      if (result.success) {
        clearRetryAfterStatus();
        dispatch({ type: 'sendCodeSucceeded', email: requestEmail });
        cooldown.start();
        clearVerificationStepTimeout();
        verificationStepTimeoutRef.current = setTimeout(() => {
          if (requestId !== sendRequestIdRef.current) return;
          dispatch({ type: 'enterVerification' });
        }, 500);
        return;
      }

      const hasRetryAfter = startRetryAfterStatus(result.retryAfterSeconds);
      if (!hasRetryAfter) {
        setStatus({
          variant: 'error',
          title: PASSWORD_RESET_COPY.status.sendCodeFailureTitle,
          message: result.error ?? PASSWORD_RESET_COPY.status.defaultServerError,
        });
      }
      dispatch({ type: 'sendCodeFailed' });
    } catch {
      if (requestId !== sendRequestIdRef.current) return;
      setStatus({
        variant: 'error',
        title: PASSWORD_RESET_COPY.status.networkTitle,
        message: PASSWORD_RESET_COPY.status.defaultNetworkError,
      });
      dispatch({ type: 'sendCodeFailed' });
    }
  }, [
    clearRetryAfterStatus,
    clearVerificationStepTimeout,
    cooldown,
    retryAfter.isActive,
    startRetryAfterStatus,
    state.email,
    state.isSendingCode,
  ]);

  const verifyCode = useCallback(async (): Promise<PasswordResetActionResult> => {
    if (state.isVerifyingCode) return { success: false };

    const targetEmail = state.requestedEmail || state.email;
    setStatus(null);
    dispatch({ type: 'verifyCodeStarted' });

    try {
      const result = await authApi.verifyResetCode(targetEmail, state.verificationCode);
      if (result.success) {
        clearRetryAfterStatus();
        cooldown.stop();
        dispatch({ type: 'verifyCodeSucceeded' });
        return { success: true };
      }

      const hasRetryAfter = startRetryAfterStatus(result.retryAfterSeconds);
      const codeFieldError = result.fieldErrors?.code;
      if (!hasRetryAfter) {
        setStatus({
          variant: 'error',
          title: PASSWORD_RESET_COPY.status.verifyFailureTitle,
          message: result.error ?? PASSWORD_RESET_COPY.status.verifyFailureMessage,
        });
      }
      dispatch({ type: 'verifyCodeFailed' });
      return {
        success: false,
        error: result.error ?? PASSWORD_RESET_COPY.status.verifyFailureMessage,
        code: result.code,
        ...(codeFieldError ? { fieldErrors: { code: codeFieldError } } : {}),
        retryAfterSeconds: result.retryAfterSeconds,
      };
    } catch {
      setStatus({
        variant: 'error',
        title: PASSWORD_RESET_COPY.status.networkTitle,
        message: PASSWORD_RESET_COPY.status.defaultNetworkError,
      });
      dispatch({ type: 'verifyCodeFailed' });
      return { success: false, error: PASSWORD_RESET_COPY.status.defaultNetworkError };
    }
  }, [
    clearRetryAfterStatus,
    cooldown,
    startRetryAfterStatus,
    state.email,
    state.isVerifyingCode,
    state.requestedEmail,
    state.verificationCode,
  ]);

  const resetPassword = useCallback(async (): Promise<PasswordResetActionResult> => {
    if (state.isResettingPassword) return { success: false };

    const targetEmail = state.requestedEmail || state.email;
    setStatus(null);
    dispatch({ type: 'resetPasswordStarted' });

    try {
      const result = await authApi.resetPassword(targetEmail, state.newPassword);
      if (result.success) {
        clearRetryAfterStatus();
        setStatus(null);
        dispatch({ type: 'resetPasswordSucceeded' });
        return { success: true };
      }

      const hasRetryAfter = startRetryAfterStatus(result.retryAfterSeconds);
      const restartRequired = isPasswordResetRestartRequired(result.code);
      const newPasswordFieldError = result.fieldErrors?.newPassword;
      const fieldErrors = newPasswordFieldError
        ? { newPassword: newPasswordFieldError }
        : undefined;
      if (restartRequired) {
        setStatus({
          variant: 'warning',
          title: PASSWORD_RESET_COPY.status.resetRestartTitle,
          message: result.error ?? PASSWORD_RESET_COPY.status.resetRestartMessage,
          action: 'restart',
        });
      } else if (!hasRetryAfter && !newPasswordFieldError) {
        setStatus({
          variant: 'error',
          title: PASSWORD_RESET_COPY.status.resetFailureTitle,
          message: result.error ?? PASSWORD_RESET_COPY.status.resetFailureMessage,
        });
      }

      dispatch({ type: 'resetPasswordFailed' });
      return {
        success: false,
        error: result.error ?? PASSWORD_RESET_COPY.status.resetFailureMessage,
        code: result.code,
        ...(fieldErrors ? { fieldErrors } : {}),
        retryAfterSeconds: result.retryAfterSeconds,
        restartRequired,
      };
    } catch {
      setStatus({
        variant: 'error',
        title: PASSWORD_RESET_COPY.status.networkTitle,
        message: PASSWORD_RESET_COPY.status.defaultNetworkError,
      });
      dispatch({ type: 'resetPasswordFailed' });
      return { success: false, error: PASSWORD_RESET_COPY.status.defaultNetworkError };
    }
  }, [
    clearRetryAfterStatus,
    startRetryAfterStatus,
    state.email,
    state.isResettingPassword,
    state.newPassword,
    state.requestedEmail,
  ]);

  const goBack = useCallback(() => {
    setStatus(null);
    if (state.step === 'verification') {
      dispatch({ type: 'backToEmail' });
      return;
    }

    if (state.step === 'newPassword') {
      dispatch({ type: 'backToVerification' });
    }
  }, [state.step]);

  const goToLogin = useCallback(() => {
    router.push('/login');
  }, [router]);

  const goToLoginAfterReset = useCallback(() => {
    router.replace('/login?reset=success');
  }, [router]);

  const changeVerificationCode = useCallback((verificationCode: string) => {
    setStatus((current) =>
      current?.title === PASSWORD_RESET_COPY.status.verifyFailureTitle || current?.isRetryAfter
        ? null
        : current,
    );
    dispatch({ type: 'verificationCodeChanged', verificationCode });
  }, []);

  const changeNewPassword = useCallback((newPassword: string) => {
    setStatus((current) =>
      current?.title === PASSWORD_RESET_COPY.status.resetFailureTitle ? null : current,
    );
    dispatch({ type: 'newPasswordChanged', newPassword });
  }, []);

  const stepNumber = state.step === 'email' ? 1 : state.step === 'verification' ? 2 : 3;

  return {
    state,
    stepNumber,
    cooldown,
    status: visibleStatus,
    isAuthenticated,
    actions: {
      changeEmail,
      sendCode,
      restartEmailEntry,
      goBack,
      goToLogin,
      goToLoginAfterReset,
      changeVerificationCode,
      verifyCode,
      changeNewPassword,
      changeConfirmPassword: (confirmPassword: string) =>
        dispatch({ type: 'confirmPasswordChanged', confirmPassword }),
      resetPassword,
    },
  };
}
