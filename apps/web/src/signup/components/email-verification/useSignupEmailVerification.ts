'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCountdown } from '@/hooks/useCountdown';
import { validateKnuEmail } from '@/utils/validation';
import { SIGNUP_VERIFICATION_CODE_TTL } from '@/constants/auth';
import { authApi } from '@/auth/api';

interface UseSignupEmailVerificationParams {
  email: string;
  onVerified: () => void;
}

type RetryAfterTarget = 'email' | 'code';

export function useSignupEmailVerification({
  email,
  onVerified,
}: UseSignupEmailVerificationParams) {
  const [verificationCode, setVerificationCode] = useState('');
  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [requestedEmail, setRequestedEmail] = useState('');
  const [retryAfterTarget, setRetryAfterTarget] = useState<RetryAfterTarget | null>(null);
  const sendTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const sendRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    };
  }, []);

  const {
    countdown,
    isActive: isCountdownActive,
    start: startCountdown,
    stop: stopCountdown,
    formatTime,
  } = useCountdown(SIGNUP_VERIFICATION_CODE_TTL);
  const {
    countdown: retryAfterSeconds,
    isActive: isRetryAfterActive,
    start: startRetryAfter,
    stop: stopRetryAfter,
  } = useCountdown(0);

  const retryAfterMessage = useMemo(() => {
    if (!isRetryAfterActive) return '';
    return `너무 잦은 요청이에요. ${retryAfterSeconds}초 후 다시 시도해주세요.`;
  }, [isRetryAfterActive, retryAfterSeconds]);

  const visibleEmailError =
    retryAfterTarget === 'email' && retryAfterMessage ? retryAfterMessage : emailError;
  const visibleCodeError =
    retryAfterTarget === 'code' && retryAfterMessage ? retryAfterMessage : codeError;
  const emailRetryAfterSeconds = retryAfterTarget === 'email' ? retryAfterSeconds : 0;
  const codeRetryAfterSeconds = retryAfterTarget === 'code' ? retryAfterSeconds : 0;

  const startRetryAfterCountdown = useCallback(
    (target: RetryAfterTarget, seconds: number | undefined): boolean => {
      if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
        return false;
      }

      setRetryAfterTarget(target);
      startRetryAfter(Math.ceil(seconds));
      return true;
    },
    [startRetryAfter],
  );

  const clearRetryAfterCountdown = useCallback(() => {
    setRetryAfterTarget(null);
    stopRetryAfter();
  }, [stopRetryAfter]);

  const handleSendCode = useCallback(async () => {
    if (isSending) return;

    const error = validateKnuEmail(email);
    if (error) {
      setEmailError(error);
      return;
    }

    const requestEmail = email.trim();
    const requestId = ++sendRequestIdRef.current;
    setEmailError('');
    setIsSending(true);

    try {
      const result = await authApi.sendSignupCode(requestEmail);
      if (requestId !== sendRequestIdRef.current) return;

      if (result.success) {
        clearRetryAfterCountdown();
        setRequestedEmail(requestEmail);
        sendTimerRef.current = setTimeout(() => {
          if (requestId !== sendRequestIdRef.current) return;
          setIsSending(false);
          setIsCodeSent(true);
          startCountdown();
        }, 1000);
      } else {
        const hasRetryAfter = startRetryAfterCountdown('email', result.retryAfterSeconds);
        setEmailError(hasRetryAfter ? '' : (result.error ?? '인증 코드 전송에 실패했습니다.'));
        setIsSending(false);
      }
    } catch {
      setEmailError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      setIsSending(false);
    }
  }, [clearRetryAfterCountdown, email, isSending, startCountdown, startRetryAfterCountdown]);

  const handleVerifyCode = useCallback(async () => {
    if (!verificationCode) {
      setCodeError('인증 코드를 입력해주세요.');
      return;
    }
    setIsVerifying(true);
    try {
      const result = await authApi.verifyEmailCode(requestedEmail || email, verificationCode);
      if (result.success) {
        clearRetryAfterCountdown();
        setCodeError('');
        onVerified();
        stopCountdown();
      } else {
        const hasRetryAfter = startRetryAfterCountdown('code', result.retryAfterSeconds);
        setCodeError(hasRetryAfter ? '' : (result.error ?? '인증 코드가 올바르지 않습니다.'));
      }
    } catch {
      setCodeError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsVerifying(false);
    }
  }, [
    clearRetryAfterCountdown,
    email,
    onVerified,
    requestedEmail,
    startRetryAfterCountdown,
    stopCountdown,
    verificationCode,
  ]);

  const handleCodeChange = useCallback((value: string) => {
    setVerificationCode(value);
    setCodeError('');
  }, []);

  const handleEmailChange = useCallback(() => {
    sendRequestIdRef.current += 1;
    if (sendTimerRef.current) {
      clearTimeout(sendTimerRef.current);
      sendTimerRef.current = null;
    }
    setIsSending(false);
    setRequestedEmail('');
    setEmailError('');
    stopCountdown();
    clearRetryAfterCountdown();
    setIsCodeSent(false);
    setVerificationCode('');
    setCodeError('');
  }, [clearRetryAfterCountdown, stopCountdown]);

  return {
    verificationCode,
    emailError: visibleEmailError,
    codeError: visibleCodeError,
    isCodeSent,
    isSending,
    isVerifying,
    requestedEmail,
    isCountdownActive,
    isRetryAfterActive,
    countdown,
    emailRetryAfterSeconds,
    codeRetryAfterSeconds,
    formatTime,
    handleSendCode,
    handleVerifyCode,
    handleCodeChange,
    handleEmailChange,
  };
}
