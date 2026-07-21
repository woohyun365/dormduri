'use client';

import { InputField } from '@/auth/components/form/InputField';
import { Button } from '@/components/ui/Button';
import { StepHeader } from '@/auth/components/StepHeader';
import { useSignupEmailVerification } from './useSignupEmailVerification';
import { EmailVerificationRequestPanel } from './EmailVerificationRequestPanel';
import { EmailVerificationCodePanel } from './EmailVerificationCodePanel';
import { Mail, CheckCircle } from 'lucide-react';
import Link from 'next/link';

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
        icon={<Mail className="size-8 text-(--knu-primary)" />}
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
              verification.handleEmailChange();
            }}
            error={verification.emailError}
            disabled={isVerified}
          />
          {isVerified && (
            <div className="absolute right-4 top-11 flex items-center gap-1 text-green-600">
              <CheckCircle className="size-5" />
              <span className="text-sm font-semibold">인증완료</span>
            </div>
          )}
        </div>

        {!verification.isCodeSent && !isVerified && (
          <EmailVerificationRequestPanel
            isSending={verification.isSending}
            retryAfterSeconds={verification.emailRetryAfterSeconds}
            onSendCode={verification.handleSendCode}
          />
        )}

        {!verification.isCodeSent && !isVerified && (
          <p className="text-xs text-(--knu-text-tertiary)">
            이미 계정이 있다면{' '}
            <Link
              href="/login"
              className="font-semibold text-(--knu-primary) hover:text-(--knu-primary-hover) transition-colors"
            >
              로그인
            </Link>
            이나{' '}
            <Link
              href="/password-reset"
              className="font-semibold text-(--knu-primary) hover:text-(--knu-primary-hover) transition-colors"
            >
              비밀번호 찾기
            </Link>
            를 이용해주세요.
          </p>
        )}

        {verification.isCodeSent && !isVerified && (
          <EmailVerificationCodePanel
            email={verification.requestedEmail || email}
            verificationCode={verification.verificationCode}
            codeError={verification.codeError}
            isVerifying={verification.isVerifying}
            isSending={verification.isSending}
            isCountdownActive={verification.isCountdownActive}
            emailRetryAfterSeconds={verification.emailRetryAfterSeconds}
            codeRetryAfterSeconds={verification.codeRetryAfterSeconds}
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
