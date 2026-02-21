'use client';

import { useState } from 'react';
import { InputField } from '@/components/form/InputField';
import { Button } from '@/components/Button';
import { StepHeader } from '@/components/StepHeader';
import { DevOnly } from '@/components/DevOnly';
import { TEST_VERIFICATION_CODE } from '@/constants/auth';
import { Mail } from 'lucide-react';

interface StepVerificationProps {
  email: string;
  countdown: number;
  formatTime: () => string;
  onResendCode: () => void;
  onVerified: () => void;
}

export function StepVerification({
  email,
  countdown,
  formatTime,
  onResendCode,
  onVerified,
}: StepVerificationProps) {
  const [verificationCode, setVerificationCode] = useState('');
  const [codeError, setCodeError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode) {
      setCodeError('인증 코드를 입력해주세요.');
      return;
    }
    if (verificationCode === TEST_VERIFICATION_CODE) {
      setCodeError('');
      onVerified();
    } else {
      setCodeError('인증 코드가 올바르지 않습니다.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <StepHeader
        icon={<Mail className="w-8 h-8 text-[var(--knu-primary)]" />}
        title="인증 코드 확인"
        description={`${email}로 전송된 코드를 입력해주세요`}
      />

      <div className="relative">
        <InputField
          label="인증 코드"
          type="text"
          placeholder="6자리 인증 코드"
          value={verificationCode}
          onChange={(value) => {
            setVerificationCode(value);
            setCodeError('');
          }}
          error={codeError}
          maxLength={6}
        />
        {countdown > 0 && (
          <div
            className="absolute right-4 top-11 text-sm font-semibold text-red-500"
            role="timer"
            aria-live="polite"
          >
            {formatTime()}
          </div>
        )}
      </div>

      <DevOnly>
        <p className="text-sm text-blue-900">
          <strong>테스트용 인증 코드:</strong> {TEST_VERIFICATION_CODE}
        </p>
      </DevOnly>

      <div className="flex gap-3">
        <Button variant="outline" size="lg" fullWidth type="button" onClick={onResendCode}>
          재전송
        </Button>
        <Button variant="primary" size="lg" fullWidth type="submit">
          확인
        </Button>
      </div>
    </form>
  );
}
