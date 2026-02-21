'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthHeader } from '@/components/AuthHeader';
import { ProgressBar } from '@/components/form/ProgressBar';
import { useCountdown } from '@/hooks/useCountdown';
import { VERIFICATION_CODE_TTL } from '@/constants/auth';
import { StepEmail } from './components/StepEmail';
import { StepVerification } from './components/StepVerification';
import { StepNewPassword } from './components/StepNewPassword';
import { StepResetComplete } from './components/StepResetComplete';

type ResetStep = 'email' | 'verification' | 'newPassword' | 'complete';

export default function PasswordReset() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const {
    countdown,
    start: startCountdown,
    stop: stopCountdown,
    formatTime,
  } = useCountdown(VERIFICATION_CODE_TTL);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleSendCode = () => {
    startCountdown();
    timeoutRef.current = setTimeout(() => {
      setCurrentStep('verification');
    }, 500);
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
              onEmailChange={setEmail}
              onSendCode={handleSendCode}
              onGoToLogin={() => router.push('/login')}
            />
          )}
          {currentStep === 'verification' && (
            <StepVerification
              email={email}
              countdown={countdown}
              formatTime={formatTime}
              onResendCode={handleSendCode}
              onVerified={handleVerified}
            />
          )}
          {currentStep === 'newPassword' && (
            <StepNewPassword onResetComplete={() => setCurrentStep('complete')} />
          )}
          {currentStep === 'complete' && (
            <StepResetComplete onGoToLogin={() => router.push('/login')} />
          )}
        </div>
      </div>
    </div>
  );
}
