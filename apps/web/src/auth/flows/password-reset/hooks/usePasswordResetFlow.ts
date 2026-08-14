import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/auth/api';
import {
  AUTH_VERIFICATION_CODE_MAX_ATTEMPTS,
  AUTH_VERIFICATION_GRANT_TTL_SECONDS,
  RESET_PASSWORD_VERIFICATION_CODE_TTL_SECONDS,
} from '@repo/shared/auth/policy';
import {
  initialPasswordResetFlowState,
  passwordResetFlowReducer,
} from '../model/password-reset-flow.reducer';
import type {
  PasswordResetActionResult,
  PasswordResetStatus,
} from '../model/password-reset-flow.types';
import { PASSWORD_RESET_COPY } from '../model/password-reset-copy';
import {
  isPasswordResetRestartRequired,
  normalizeRetryAfterSeconds,
} from '../model/password-reset-error.mapper';
import { usePasswordResetCooldown } from './usePasswordResetCooldown';

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function expiresAt(seconds: number): number {
  return Date.now() + seconds * 1_000;
}

export function usePasswordResetFlow() {
  const router = useRouter();
  const [state, dispatch] = useReducer(passwordResetFlowReducer, initialPasswordResetFlowState);
  const [status, setStatus] = useState<PasswordResetStatus | null>(null);
  const codeExpiry = usePasswordResetCooldown(RESET_PASSWORD_VERIFICATION_CODE_TTL_SECONDS);
  const retryAfter = usePasswordResetCooldown(0);
  const activeRequestRef = useRef<AbortController | null>(null);
  const verificationFailureCountRef = useRef(0);

  const visibleStatus = useMemo<PasswordResetStatus | null>(() => {
    if (!status?.isRetryAfter) return status;
    if (!retryAfter.isActive) return null;

    return {
      ...status,
      countdownSeconds: retryAfter.countdown,
    };
  }, [retryAfter.countdown, retryAfter.isActive, status]);

  const abortActiveRequest = useCallback(() => {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
  }, []);

  const beginRequest = useCallback(() => {
    abortActiveRequest();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    return controller;
  }, [abortActiveRequest]);

  const finishRequest = useCallback((controller: AbortController) => {
    if (activeRequestRef.current === controller) {
      activeRequestRef.current = null;
    }
  }, []);

  useEffect(() => abortActiveRequest, [abortActiveRequest]);

  const startRetryAfterStatus = useCallback(
    (seconds: number | undefined, title = PASSWORD_RESET_COPY.status.retryAfterTitle): boolean => {
      const normalizedSeconds = normalizeRetryAfterSeconds(seconds);
      if (!normalizedSeconds) return false;

      retryAfter.start(normalizedSeconds);
      setStatus({
        variant: 'warning',
        title,
        isRetryAfter: true,
        countdownSeconds: normalizedSeconds,
      });
      return true;
    },
    [retryAfter],
  );

  const clearRetryAfterStatus = useCallback(() => {
    retryAfter.stop();
    setStatus((current) => (current?.isRetryAfter ? null : current));
  }, [retryAfter]);

  const restartEmailEntry = useCallback(() => {
    abortActiveRequest();
    codeExpiry.stop();
    clearRetryAfterStatus();
    verificationFailureCountRef.current = 0;
    setStatus(null);
    dispatch({ type: 'restartEmailEntry' });
  }, [abortActiveRequest, clearRetryAfterStatus, codeExpiry]);

  const restartExpiredReset = useCallback(() => {
    abortActiveRequest();
    codeExpiry.stop();
    clearRetryAfterStatus();
    verificationFailureCountRef.current = 0;
    dispatch({ type: 'restartEmailEntry' });
    setStatus({
      variant: 'warning',
      title: PASSWORD_RESET_COPY.status.resetRestartTitle,
      message: PASSWORD_RESET_COPY.status.resetRestartMessage,
    });
  }, [abortActiveRequest, clearRetryAfterStatus, codeExpiry]);

  const changeEmail = useCallback(
    (email: string) => {
      abortActiveRequest();
      codeExpiry.stop();
      clearRetryAfterStatus();
      verificationFailureCountRef.current = 0;
      setStatus(null);
      dispatch({ type: 'emailChanged', email });
    },
    [abortActiveRequest, clearRetryAfterStatus, codeExpiry],
  );

  const sendCode = useCallback(async () => {
    if (
      (state.step !== 'email' && state.step !== 'verification') ||
      state.operation !== 'idle' ||
      retryAfter.isActive
    ) {
      return;
    }

    const requestEmail = state.email.trim();
    const isResend = state.step === 'verification';
    const controller = beginRequest();
    setStatus(null);
    dispatch({ type: 'sendCodeStarted' });

    try {
      const result = await authApi.sendResetCode(requestEmail, controller.signal);
      if (controller.signal.aborted) return;

      if (result.success) {
        clearRetryAfterStatus();
        verificationFailureCountRef.current = 0;
        const codeExpiresAt = expiresAt(RESET_PASSWORD_VERIFICATION_CODE_TTL_SECONDS);
        dispatch({ type: 'sendCodeSucceeded', email: requestEmail, codeExpiresAt });
        codeExpiry.start(RESET_PASSWORD_VERIFICATION_CODE_TTL_SECONDS);
        if (isResend) {
          setStatus({
            variant: 'success',
            title: PASSWORD_RESET_COPY.status.resendSucceededTitle,
            message: PASSWORD_RESET_COPY.status.resendSucceededMessage,
          });
        }
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
    } catch (error) {
      if (isAbortError(error)) return;
      setStatus({
        variant: 'error',
        kind: 'network',
        title: PASSWORD_RESET_COPY.status.sendCodeNetworkTitle,
        message: PASSWORD_RESET_COPY.status.defaultNetworkError,
      });
      dispatch({ type: 'sendCodeFailed' });
    } finally {
      finishRequest(controller);
    }
  }, [
    beginRequest,
    clearRetryAfterStatus,
    codeExpiry,
    finishRequest,
    retryAfter.isActive,
    startRetryAfterStatus,
    state,
  ]);

  const verifyCode = useCallback(async (): Promise<PasswordResetActionResult> => {
    if (state.step !== 'verification' || state.operation !== 'idle' || retryAfter.isActive) {
      return { success: false };
    }
    if (!codeExpiry.isActive || state.codeExpiresAt <= Date.now()) {
      return {
        success: false,
        fieldErrors: { code: PASSWORD_RESET_COPY.verification.expired },
      };
    }

    const controller = beginRequest();
    setStatus(null);
    dispatch({ type: 'verifyCodeStarted' });

    try {
      const result = await authApi.verifyResetCode(
        state.email,
        state.verificationCode,
        controller.signal,
      );
      if (controller.signal.aborted) return { success: false };
      if (result.success) {
        clearRetryAfterStatus();
        codeExpiry.stop();
        verificationFailureCountRef.current = 0;
        dispatch({
          type: 'verifyCodeSucceeded',
          grantExpiresAt: expiresAt(
            result.grantExpiresInSeconds ?? AUTH_VERIFICATION_GRANT_TTL_SECONDS,
          ),
        });
        return { success: true };
      }

      if (result.code === 'AUTH_VERIFICATION_CODE_INVALID') {
        verificationFailureCountRef.current += 1;

        if (verificationFailureCountRef.current >= AUTH_VERIFICATION_CODE_MAX_ATTEMPTS) {
          codeExpiry.stop();
          setStatus({
            variant: 'warning',
            kind: 'attempts-exhausted',
            title: PASSWORD_RESET_COPY.status.attemptsExhaustedTitle,
            message: PASSWORD_RESET_COPY.status.attemptsExhaustedMessage,
          });
          dispatch({ type: 'verifyCodeFailed' });
          return {
            success: false,
            error: PASSWORD_RESET_COPY.status.attemptsExhaustedMessage,
            code: result.code,
          };
        }
      }

      const hasRetryAfter = startRetryAfterStatus(result.retryAfterSeconds);
      const codeFieldError = result.fieldErrors?.code;
      if (!hasRetryAfter && !codeFieldError) {
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
    } catch (error) {
      if (isAbortError(error)) return { success: false };
      setStatus({
        variant: 'error',
        kind: 'network',
        title: PASSWORD_RESET_COPY.status.verifyCodeNetworkTitle,
        message: PASSWORD_RESET_COPY.status.defaultNetworkError,
      });
      dispatch({ type: 'verifyCodeFailed' });
      return { success: false };
    } finally {
      finishRequest(controller);
    }
  }, [
    beginRequest,
    clearRetryAfterStatus,
    codeExpiry,
    finishRequest,
    retryAfter.isActive,
    startRetryAfterStatus,
    state,
  ]);

  const resetPassword = useCallback(async (): Promise<PasswordResetActionResult> => {
    if (state.step !== 'newPassword' || state.operation !== 'idle' || retryAfter.isActive) {
      return { success: false };
    }
    if (state.grantExpiresAt <= Date.now()) {
      restartExpiredReset();
      return {
        success: false,
        error: PASSWORD_RESET_COPY.status.resetRestartMessage,
        restartRequired: true,
      };
    }

    const controller = beginRequest();
    setStatus(null);
    dispatch({ type: 'resetPasswordStarted' });

    try {
      const result = await authApi.resetPassword(state.email, state.newPassword, controller.signal);
      if (controller.signal.aborted) return { success: false };
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
        restartExpiredReset();
      } else if (!hasRetryAfter && !newPasswordFieldError) {
        setStatus({
          variant: 'error',
          title: PASSWORD_RESET_COPY.status.resetFailureTitle,
          message: result.error ?? PASSWORD_RESET_COPY.status.resetFailureMessage,
        });
      }

      if (!restartRequired) {
        dispatch({ type: 'resetPasswordFailed' });
      }
      return {
        success: false,
        error: result.error ?? PASSWORD_RESET_COPY.status.resetFailureMessage,
        code: result.code,
        ...(fieldErrors ? { fieldErrors } : {}),
        retryAfterSeconds: result.retryAfterSeconds,
        restartRequired,
      };
    } catch (error) {
      if (isAbortError(error)) return { success: false };
      setStatus({
        variant: 'error',
        kind: 'network',
        title: PASSWORD_RESET_COPY.status.resetPasswordNetworkTitle,
        message: PASSWORD_RESET_COPY.status.defaultNetworkError,
      });
      dispatch({ type: 'resetPasswordFailed' });
      return { success: false };
    } finally {
      finishRequest(controller);
    }
  }, [
    beginRequest,
    clearRetryAfterStatus,
    finishRequest,
    retryAfter.isActive,
    restartExpiredReset,
    startRetryAfterStatus,
    state,
  ]);

  const goBack = useCallback(() => {
    if (state.step !== 'verification') return;
    abortActiveRequest();
    codeExpiry.stop();
    clearRetryAfterStatus();
    setStatus(null);
    dispatch({ type: 'backToEmail' });
  }, [abortActiveRequest, clearRetryAfterStatus, codeExpiry, state.step]);

  const goToLogin = useCallback(() => {
    router.push('/login');
  }, [router]);

  const goToLoginAfterReset = useCallback(() => {
    router.replace('/login?reset=success');
  }, [router]);

  const continueAfterVerification = useCallback(() => {
    if (state.step !== 'verified') return;
    if (state.grantExpiresAt <= Date.now()) {
      restartExpiredReset();
      return;
    }
    setStatus(null);
    dispatch({ type: 'continueAfterVerification' });
  }, [restartExpiredReset, state]);

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

  return {
    state,
    codeExpiry,
    status: visibleStatus,
    actions: {
      changeEmail,
      sendCode,
      restartEmailEntry,
      goBack,
      goToLogin,
      goToLoginAfterReset,
      changeVerificationCode,
      verifyCode,
      continueAfterVerification,
      changeNewPassword,
      changeConfirmPassword: (confirmPassword: string) =>
        dispatch({ type: 'confirmPasswordChanged', confirmPassword }),
      resetPassword,
    },
  };
}
