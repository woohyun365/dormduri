'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthCountdown } from '@/auth/hooks';
import {
  AUTH_VERIFICATION_CODE_MAX_ATTEMPTS,
  SIGNUP_VERIFICATION_CODE_TTL_SECONDS,
  validateKnuEmailFormat as validateKnuEmail,
} from '@repo/shared/auth/policy';
import { authApi } from '@/auth/api';
import type { AuthActionFeedbackState } from '@/auth/components/feedback/auth-action-feedback.types';
import { SIGNUP_FEEDBACK_COPY } from '../../model/signup-feedback.copy';

interface UseSignupEmailVerificationParams {
  email: string;
  onVerified: () => void;
}

type RetryAfterTarget = 'email' | 'code';

interface SignupEmailActionFeedback extends AuthActionFeedbackState {
  isRetryAfter?: boolean;
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
  const [requestedEmail, setRequestedEmail] = useState('');
  const [actionFeedback, setActionFeedback] = useState<SignupEmailActionFeedback | null>(null);
  const [isAttemptsExhausted, setIsAttemptsExhausted] = useState(false);
  const [retryAfterTarget, setRetryAfterTarget] = useState<RetryAfterTarget | null>(null);
  const sendTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const sendRequestIdRef = useRef(0);
  const verificationFailureCountRef = useRef(0);

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
  } = useAuthCountdown(SIGNUP_VERIFICATION_CODE_TTL_SECONDS);
  const {
    countdown: retryAfterSeconds,
    isActive: isRetryAfterActive,
    start: startRetryAfter,
    stop: stopRetryAfter,
  } = useAuthCountdown(0);

  const visibleActionFeedback = useMemo(
    () => (actionFeedback?.isRetryAfter && !isRetryAfterActive ? null : actionFeedback),
    [actionFeedback, isRetryAfterActive],
  );
  const emailRetryAfterSeconds = retryAfterTarget === 'email' ? retryAfterSeconds : 0;
  const codeRetryAfterSeconds = retryAfterTarget === 'code' ? retryAfterSeconds : 0;

  const startRetryAfterCountdown = useCallback(
    (target: RetryAfterTarget, seconds: number | undefined): boolean => {
      if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
        return false;
      }

      setRetryAfterTarget(target);
      setActionFeedback({
        variant: 'warning',
        title: SIGNUP_FEEDBACK_COPY.common.retryAfter.title,
        isRetryAfter: true,
      });
      startRetryAfter(Math.ceil(seconds));
      return true;
    },
    [startRetryAfter],
  );

  const clearRetryAfterCountdown = useCallback(() => {
    setRetryAfterTarget(null);
    stopRetryAfter();
    setActionFeedback((current) => (current?.isRetryAfter ? null : current));
  }, [stopRetryAfter]);

  const handleSendCode = useCallback(async () => {
    if (isSending) return;

    const error = validateKnuEmail(email);
    if (error) {
      setEmailError(error);
      return;
    }

    const requestEmail = email.trim();
    const isResend = isCodeSent;
    const requestId = ++sendRequestIdRef.current;
    setEmailError('');
    setActionFeedback(null);
    setIsSending(true);

    try {
      const result = await authApi.sendSignupCode(requestEmail);
      if (requestId !== sendRequestIdRef.current) return;

      if (result.success) {
        clearRetryAfterCountdown();
        verificationFailureCountRef.current = 0;
        setIsAttemptsExhausted(false);
        setRequestedEmail(requestEmail);
        if (isResend) {
          setVerificationCode('');
          setCodeError('');
          setIsSending(false);
          setIsCodeSent(true);
          setActionFeedback({
            variant: 'success',
            ...SIGNUP_FEEDBACK_COPY.email.resendSucceeded,
          });
          startCountdown();
          return;
        }
        sendTimerRef.current = setTimeout(() => {
          if (requestId !== sendRequestIdRef.current) return;
          setIsSending(false);
          setIsCodeSent(true);
          startCountdown();
        }, 1000);
      } else {
        const hasRetryAfter = startRetryAfterCountdown('email', result.retryAfterSeconds);
        if (!hasRetryAfter) {
          setActionFeedback({
            variant: 'error',
            title: SIGNUP_FEEDBACK_COPY.email.sendFailedTitle,
            description: result.error ?? SIGNUP_FEEDBACK_COPY.common.retry,
          });
        }
        setIsSending(false);
      }
    } catch {
      setActionFeedback({
        variant: 'connectivity',
        title: SIGNUP_FEEDBACK_COPY.email.sendFailedTitle,
        description: SIGNUP_FEEDBACK_COPY.common.connectivity,
      });
      setIsSending(false);
    }
  }, [
    clearRetryAfterCountdown,
    email,
    isCodeSent,
    isSending,
    startCountdown,
    startRetryAfterCountdown,
  ]);

  const handleVerifyCode = useCallback(async () => {
    if (isSending || isVerifying) return;
    if (!verificationCode) {
      setCodeError(SIGNUP_FEEDBACK_COPY.email.requiredCode);
      return;
    }
    if (isAttemptsExhausted) return;

    setActionFeedback(null);
    setIsVerifying(true);
    try {
      const result = await authApi.verifyEmailCode(requestedEmail || email, verificationCode);
      if (result.success) {
        clearRetryAfterCountdown();
        verificationFailureCountRef.current = 0;
        setIsAttemptsExhausted(false);
        setCodeError('');
        onVerified();
        stopCountdown();
      } else {
        const isInvalidCode = result.code === 'AUTH_VERIFICATION_CODE_INVALID';
        if (isInvalidCode) {
          verificationFailureCountRef.current += 1;

          if (verificationFailureCountRef.current >= AUTH_VERIFICATION_CODE_MAX_ATTEMPTS) {
            stopCountdown();
            setCodeError('');
            setIsAttemptsExhausted(true);
            setActionFeedback({
              variant: 'warning',
              ...SIGNUP_FEEDBACK_COPY.common.verificationCodeUnavailable,
            });
            return;
          }
        }

        const hasRetryAfter = startRetryAfterCountdown('code', result.retryAfterSeconds);
        if (hasRetryAfter) {
          setCodeError('');
        } else if (isInvalidCode) {
          setCodeError(result.error ?? SIGNUP_FEEDBACK_COPY.email.invalidCode);
        } else {
          setActionFeedback({
            variant: 'error',
            title: SIGNUP_FEEDBACK_COPY.email.verificationFailedTitle,
            description: result.error ?? SIGNUP_FEEDBACK_COPY.common.retry,
          });
        }
      }
    } catch {
      setActionFeedback({
        variant: 'connectivity',
        title: SIGNUP_FEEDBACK_COPY.email.verificationFailedTitle,
        description: SIGNUP_FEEDBACK_COPY.common.connectivity,
      });
    } finally {
      setIsVerifying(false);
    }
  }, [
    clearRetryAfterCountdown,
    email,
    isAttemptsExhausted,
    isSending,
    isVerifying,
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
    setActionFeedback(null);
    verificationFailureCountRef.current = 0;
    setIsAttemptsExhausted(false);
    stopCountdown();
    clearRetryAfterCountdown();
    setIsCodeSent(false);
    setVerificationCode('');
    setCodeError('');
  }, [clearRetryAfterCountdown, stopCountdown]);

  return {
    verificationCode,
    emailError,
    codeError,
    actionFeedback: visibleActionFeedback,
    isAttemptsExhausted,
    isCodeSent,
    isSending,
    isVerifying,
    requestedEmail,
    isCountdownActive,
    isRetryAfterActive,
    countdown,
    emailRetryAfterSeconds,
    codeRetryAfterSeconds,
    handleSendCode,
    handleVerifyCode,
    handleCodeChange,
    handleEmailChange,
  };
}
