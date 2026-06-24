import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/api/auth';
import {
  initialPasswordResetFlowState,
  passwordResetFlowReducer,
} from '../model/password-reset-flow.reducer';
import type {
  PasswordResetActionResult,
  PasswordResetStatus,
} from '../model/password-reset-flow.types';
import { usePasswordResetCooldown } from './usePasswordResetCooldown';

const DEFAULT_SERVER_ERROR = '일시적 서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
const DEFAULT_NETWORK_ERROR = '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
const RESET_RESTART_CODE = 'AUTH_RESET_RESTART_REQUIRED';

function normalizePositiveSeconds(seconds: number | undefined): number | undefined {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }

  return Math.ceil(seconds);
}

function isRestartRequired(code: string | undefined): boolean {
  return code === RESET_RESTART_CODE;
}

export function usePasswordResetFlow() {
  const router = useRouter();
  const [state, dispatch] = useReducer(passwordResetFlowReducer, initialPasswordResetFlowState);
  const [status, setStatus] = useState<PasswordResetStatus | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const cooldown = usePasswordResetCooldown();
  const retryAfter = usePasswordResetCooldown(0);
  const verificationStepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendRequestIdRef = useRef(0);

  const visibleStatus = useMemo<PasswordResetStatus | null>(() => {
    if (!status?.isRetryAfter) return status;
    if (!retryAfter.isActive) return null;

    return {
      ...status,
      message: `너무 잦은 요청이에요. ${retryAfter.countdown}초 후 다시 시도해주세요.`,
    };
  }, [retryAfter.countdown, retryAfter.isActive, status]);

  const startRetryAfterStatus = useCallback(
    (seconds: number | undefined, title = '잠시 후 다시 시도해주세요'): boolean => {
      const normalizedSeconds = normalizePositiveSeconds(seconds);
      if (!normalizedSeconds) return false;

      retryAfter.start(normalizedSeconds);
      setStatus({
        variant: 'warning',
        title,
        message: `너무 잦은 요청이에요. ${normalizedSeconds}초 후 다시 시도해주세요.`,
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
    let cancelled = false;

    async function loadSession() {
      try {
        const session = await authApi.getSession();
        if (!cancelled && session.authenticated) {
          setIsAuthenticated(true);
        }
      } catch {
        // Password reset remains available when optional session check fails.
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
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
        setStatus({
          variant: 'success',
          title: '인증 코드 안내',
          message:
            '입력한 이메일로 가입된 계정이 있는 경우 인증 코드가 발송돼요. 메일함과 스팸함을 확인해주세요.',
        });
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
          title: '인증 코드를 보낼 수 없어요',
          message: result.error ?? DEFAULT_SERVER_ERROR,
        });
      }
      dispatch({ type: 'sendCodeFailed' });
    } catch {
      if (requestId !== sendRequestIdRef.current) return;
      setStatus({
        variant: 'error',
        title: '네트워크를 확인해주세요',
        message: DEFAULT_NETWORK_ERROR,
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
          title: '인증 코드를 확인하지 못했어요',
          message: result.error ?? '인증 코드가 올바르지 않습니다.',
        });
      }
      dispatch({ type: 'verifyCodeFailed' });
      return {
        success: false,
        error: result.error ?? '인증 코드가 올바르지 않습니다.',
        code: result.code,
        ...(codeFieldError ? { fieldErrors: { code: codeFieldError } } : {}),
        retryAfterSeconds: result.retryAfterSeconds,
      };
    } catch {
      setStatus({
        variant: 'error',
        title: '네트워크를 확인해주세요',
        message: DEFAULT_NETWORK_ERROR,
      });
      dispatch({ type: 'verifyCodeFailed' });
      return { success: false, error: DEFAULT_NETWORK_ERROR };
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
      const restartRequired = isRestartRequired(result.code);
      const newPasswordFieldError = result.fieldErrors?.newPassword;
      const fieldErrors = newPasswordFieldError
        ? { newPassword: newPasswordFieldError }
        : undefined;
      if (restartRequired) {
        setStatus({
          variant: 'warning',
          title: '재설정을 처음부터 다시 진행해주세요',
          message:
            result.error ??
            '인증 시간이 만료되었거나 이미 사용된 요청입니다. 이메일 입력부터 다시 진행해주세요.',
          action: 'restart',
        });
      } else if (!hasRetryAfter && !newPasswordFieldError) {
        setStatus({
          variant: 'error',
          title: '비밀번호를 변경하지 못했어요',
          message: result.error ?? '비밀번호 재설정에 실패했습니다. 잠시 후 다시 시도해주세요.',
        });
      }

      dispatch({ type: 'resetPasswordFailed' });
      return {
        success: false,
        error: result.error ?? '비밀번호 재설정에 실패했습니다. 잠시 후 다시 시도해주세요.',
        code: result.code,
        ...(fieldErrors ? { fieldErrors } : {}),
        retryAfterSeconds: result.retryAfterSeconds,
        restartRequired,
      };
    } catch {
      setStatus({
        variant: 'error',
        title: '네트워크를 확인해주세요',
        message: DEFAULT_NETWORK_ERROR,
      });
      dispatch({ type: 'resetPasswordFailed' });
      return { success: false, error: DEFAULT_NETWORK_ERROR };
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
      current?.title === '인증 코드를 확인하지 못했어요' || current?.isRetryAfter ? null : current,
    );
    dispatch({ type: 'verificationCodeChanged', verificationCode });
  }, []);

  const changeNewPassword = useCallback((newPassword: string) => {
    setStatus((current) => (current?.title === '비밀번호를 변경하지 못했어요' ? null : current));
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
