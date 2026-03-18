'use client';

import { InputField } from '@/components/form/InputField';
import { Button } from '@/components/Button';
import { StepHeader } from '@/components/StepHeader';
import { useSignupEmailVerification } from './useSignupEmailVerification';
import { EmailVerificationRequestPanel } from './EmailVerificationRequestPanel';
import { EmailVerificationCodePanel } from './EmailVerificationCodePanel';
import { Mail, CheckCircle } from 'lucide-react';

interface StepEmailVerificationProps {
  email: string;
  onEmailChange: (email: string) => void;
  isVerified: boolean;
  onVerified: () => void;
  onNext: () => void;
}

export function StepEmailVerification({
  email,
  onEmailChange,
  isVerified,
  onVerified,
  onNext,
}: StepEmailVerificationProps) {
  const verification = useSignupEmailVerification({ email, onVerified });

  return (
    <div className="space-y-6">
      <StepHeader
        icon={<Mail className="w-8 h-8 text-[var(--knu-primary)]" />}
        title="이메일 인증"
        description="강원대학교 이메일로 인증해주세요"
      />

      <div className="space-y-4">
        <div className="relative">
          <InputField
            label="학교 이메일"
            type="email"
            placeholder="example@kangwon.ac.kr"
            value={email}
            onChange={(value) => {
              onEmailChange(value);
              verification.clearEmailError();
            }}
            error={verification.emailError}
            disabled={isVerified}
          />
          {isVerified && (
            <div className="absolute right-4 top-11 flex items-center gap-1 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-semibold">인증완료</span>
            </div>
          )}
        </div>

        {!verification.isCodeSent && !isVerified && (
          <EmailVerificationRequestPanel
            isSending={verification.isSending}
            onSendCode={verification.handleSendCode}
          />
        )}

        {verification.isCodeSent && !isVerified && (
          <EmailVerificationCodePanel
            verificationCode={verification.verificationCode}
            codeError={verification.codeError}
            isVerifying={verification.isVerifying}
            isSending={verification.isSending}
            isCountdownActive={verification.isCountdownActive}
            countdown={verification.countdown}
            formatTime={verification.formatTime}
            onCodeChange={verification.handleCodeChange}
            onVerifyCode={verification.handleVerifyCode}
            onResendCode={verification.handleSendCode}
          />
        )}
      </div>

      {isVerified && (
        <Button variant="primary" size="lg" fullWidth onClick={onNext}>
          다음 단계
        </Button>
      )}
    </div>
  );
}
