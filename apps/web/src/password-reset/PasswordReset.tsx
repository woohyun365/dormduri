'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AuthHeader } from '@/components/AuthHeader';
import { ProgressBar } from '@/components/form/ProgressBar';
import { useCountdown } from '@/hooks/useCountdown';
import { VERIFICATION_CODE_TTL } from '@/constants/auth';
import { StepEmail } from './components/StepEmail';
import { StepVerification } from './components/StepVerification';
import { StepNewPassword } from './components/StepNewPassword';
import { StepResetComplete } from './components/StepResetComplete';
import { authApi } from '@/api/auth';

type ResetStep = 'email' | 'verification' | 'newPassword' | 'complete';

export default function PasswordReset() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [requestedEmail, setRequestedEmail] = useState('');
  const {
    countdown,
    isActive,
    start: startCountdown,
    stop: stopCountdown,
    formatTime,
  } = useCountdown(VERIFICATION_CODE_TTL);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const [isSending, setIsSending] = useState(false);

  const resetVerificationFlow = () => {
    sendRequestIdRef.current += 1;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    stopCountdown();
    setIsSending(false);
    setRequestedEmail('');
    setCurrentStep('email');
  };

  const handleEmailChange = (nextEmail: string) => {
    setEmail(nextEmail);
    resetVerificationFlow();
  };

  const handleSendCode = async () => {
    if (isSending || isActive) return;
    const requestEmail = email.trim();
    const requestId = ++sendRequestIdRef.current;
    setIsSending(true);
    try {
      const result = await authApi.sendResetCode(requestEmail);
      if (requestId !== sendRequestIdRef.current) return;

      if (result.success) {
        toast.success('인증 코드가 전송되었어요.');
        setRequestedEmail(requestEmail);
        startCountdown();
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          if (requestId !== sendRequestIdRef.current) return;
          setCurrentStep('verification');
        }, 500);
      } else {
        toast.error(result.error ?? '일시적 서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
      }
    } catch {
      toast.error('네트워크 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerified = () => {
    stopCountdown();
    setCurrentStep('newPassword');
  };

  const stepNumber = currentStep === 'email' ? 1 : currentStep === 'verification' ? 2 : 3;

  return (
    <div className="min-h-screen bg-[var(--knu-background-alt)]">
      <AuthHeader
        showBack={currentStep !== 'email' && currentStep !== 'complete'}
        onBack={() => {
          if (currentStep === 'verification') setCurrentStep('email');
          if (currentStep === 'newPassword') setCurrentStep('verification');
        }}
      />

      <div className="mx-auto max-w-md px-5 py-12 md:py-16">
        {currentStep !== 'complete' && (
          <div className="mb-8">
            <ProgressBar currentStep={stepNumber} totalSteps={3} />
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border-2 border-[var(--knu-border)] p-6 md:p-8">
          {currentStep === 'email' && (
            <StepEmail
              email={email}
              onEmailChange={handleEmailChange}
              onSendCode={handleSendCode}
              onGoToLogin={() => router.push('/login')}
            />
          )}
          {currentStep === 'verification' && (
            <StepVerification
              email={requestedEmail || email}
              countdown={countdown}
              isActive={isActive}
              isSending={isSending}
              formatTime={formatTime}
              onResendCode={handleSendCode}
              onVerified={handleVerified}
              onBackToEmail={resetVerificationFlow}
            />
          )}
          {currentStep === 'newPassword' && (
            <StepNewPassword
              email={requestedEmail || email}
              onResetComplete={() => setCurrentStep('complete')}
            />
          )}
          {currentStep === 'complete' && (
            <StepResetComplete onGoToLogin={() => router.push('/login')} />
          )}
        </div>
      </div>
    </div>
  );
}
