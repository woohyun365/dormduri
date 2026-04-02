'use client';

import { useState, useRef, useEffect } from 'react';
import { useCountdown } from '@/hooks/useCountdown';
import { validateKnuEmail } from '@/utils/validation';
import { VERIFICATION_CODE_TTL } from '@/constants/auth';
import { authApi } from '@/api/auth';

interface UseSignupEmailVerificationParams {
  email: string;
  onVerified: () => void;
}

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
  const sendTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

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
  } = useCountdown(VERIFICATION_CODE_TTL);

  const handleSendCode = async () => {
    const error = validateKnuEmail(email);
    if (error) {
      setEmailError(error);
      return;
    }

    setEmailError('');
    setIsSending(true);

    try {
      const result = await authApi.sendSignupCode(email);
      if (result.success) {
        sendTimerRef.current = setTimeout(() => {
          setIsSending(false);
          setIsCodeSent(true);
          startCountdown();
        }, 1000);
      } else {
        setEmailError(result.error ?? '인증 코드 전송에 실패했습니다.');
        setIsSending(false);
      }
    } catch {
      setEmailError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      setIsSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) {
      setCodeError('인증 코드를 입력해주세요.');
      return;
    }
    setIsVerifying(true);
    try {
      const result = await authApi.verifyEmailCode(email, verificationCode);
      if (result.success) {
        setCodeError('');
        onVerified();
        stopCountdown();
      } else {
        setCodeError(result.error ?? '인증 코드가 올바르지 않습니다.');
      }
    } catch {
      setCodeError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCodeChange = (value: string) => {
    setVerificationCode(value);
    setCodeError('');
  };

  const handleEmailChange = () => {
    setEmailError('');
    if (isCodeSent) {
      stopCountdown();
      setIsCodeSent(false);
      setVerificationCode('');
      setCodeError('');
    }
  };

  return {
    verificationCode,
    emailError,
    codeError,
    isCodeSent,
    isSending,
    isVerifying,
    isCountdownActive,
    countdown,
    formatTime,
    handleSendCode,
    handleVerifyCode,
    handleCodeChange,
    handleEmailChange,
  };
}
