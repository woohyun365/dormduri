import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authApi } from '@/api/auth';
import {
  initialPasswordResetFlowState,
  passwordResetFlowReducer,
} from '../model/password-reset-flow.reducer';
import { usePasswordResetCooldown } from './usePasswordResetCooldown';

interface PasswordResetActionResult {
  success: boolean;
  error?: string;
}

const DEFAULT_SERVER_ERROR = '일시적 서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
const DEFAULT_NETWORK_ERROR = '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';

export function usePasswordResetFlow() {
  const router = useRouter();
  const [state, dispatch] = useReducer(passwordResetFlowReducer, initialPasswordResetFlowState);
  const cooldown = usePasswordResetCooldown();
  const verificationStepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendRequestIdRef = useRef(0);

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
    dispatch({ type: 'restartEmailEntry' });
  }, [clearVerificationStepTimeout, cooldown]);

  const changeEmail = useCallback(
    (email: string) => {
      sendRequestIdRef.current += 1;
      clearVerificationStepTimeout();
      cooldown.stop();
      dispatch({ type: 'emailChanged', email });
    },
    [clearVerificationStepTimeout, cooldown],
  );

  const sendCode = useCallback(async () => {
    if (state.isSendingCode || cooldown.isActive) return;

    const requestEmail = state.email.trim();
    const requestId = ++sendRequestIdRef.current;
    dispatch({ type: 'sendCodeStarted' });

    try {
      const result = await authApi.sendResetCode(requestEmail);
      if (requestId !== sendRequestIdRef.current) return;

      if (result.success) {
        toast.success('인증 코드가 전송되었어요.');
        dispatch({ type: 'sendCodeSucceeded', email: requestEmail });
        cooldown.start();
        clearVerificationStepTimeout();
        verificationStepTimeoutRef.current = setTimeout(() => {
          if (requestId !== sendRequestIdRef.current) return;
          dispatch({ type: 'enterVerification' });
        }, 500);
        return;
      }

      toast.error(result.error ?? DEFAULT_SERVER_ERROR);
      dispatch({ type: 'sendCodeFailed' });
    } catch {
      if (requestId !== sendRequestIdRef.current) return;
      toast.error('네트워크 오류가 발생했습니다.');
      dispatch({ type: 'sendCodeFailed' });
    }
  }, [clearVerificationStepTimeout, cooldown, state.email, state.isSendingCode]);

  const verifyCode = useCallback(async (): Promise<PasswordResetActionResult> => {
    if (state.isVerifyingCode) return { success: false };

    const targetEmail = state.requestedEmail || state.email;
    dispatch({ type: 'verifyCodeStarted' });

    try {
      const result = await authApi.verifyResetCode(targetEmail, state.verificationCode);
      if (result.success) {
        cooldown.stop();
        dispatch({ type: 'verifyCodeSucceeded' });
        return { success: true };
      }

      dispatch({ type: 'verifyCodeFailed' });
      return { success: false, error: result.error ?? '인증 코드가 올바르지 않습니다.' };
    } catch {
      dispatch({ type: 'verifyCodeFailed' });
      return { success: false, error: DEFAULT_NETWORK_ERROR };
    }
  }, [cooldown, state.email, state.isVerifyingCode, state.requestedEmail, state.verificationCode]);

  const resetPassword = useCallback(async (): Promise<PasswordResetActionResult> => {
    if (state.isResettingPassword) return { success: false };

    const targetEmail = state.requestedEmail || state.email;
    dispatch({ type: 'resetPasswordStarted' });

    try {
      const result = await authApi.resetPassword(targetEmail, state.newPassword);
      if (result.success) {
        dispatch({ type: 'resetPasswordSucceeded' });
        return { success: true };
      }

      dispatch({ type: 'resetPasswordFailed' });
      return {
        success: false,
        error: result.error ?? '비밀번호 재설정에 실패했습니다. 잠시 후 다시 시도해주세요.',
      };
    } catch {
      dispatch({ type: 'resetPasswordFailed' });
      return { success: false, error: DEFAULT_NETWORK_ERROR };
    }
  }, [state.email, state.isResettingPassword, state.newPassword, state.requestedEmail]);

  const goBack = useCallback(() => {
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

  const stepNumber = state.step === 'email' ? 1 : state.step === 'verification' ? 2 : 3;

  return {
    state,
    stepNumber,
    cooldown,
    actions: {
      changeEmail,
      sendCode,
      restartEmailEntry,
      goBack,
      goToLogin,
      changeVerificationCode: (verificationCode: string) =>
        dispatch({ type: 'verificationCodeChanged', verificationCode }),
      verifyCode,
      changeNewPassword: (newPassword: string) =>
        dispatch({ type: 'newPasswordChanged', newPassword }),
      changeConfirmPassword: (confirmPassword: string) =>
        dispatch({ type: 'confirmPasswordChanged', confirmPassword }),
      resetPassword,
    },
  };
}
