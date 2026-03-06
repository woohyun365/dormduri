'use client';

import { useState } from 'react';
import { InputField } from '@/components/form/InputField';
import { Button } from '@/components/Button';
import { StepHeader } from '@/components/StepHeader';

import { authApi } from '@/api/auth';
import { Mail } from 'lucide-react';

interface StepVerificationProps {
  email: string;
  countdown: number;
  isActive: boolean;
  isSending: boolean;
  formatTime: () => string;
  onResendCode: () => void;
  onVerified: () => void;
}

export function StepVerification({
  email,
  countdown,
  isActive,
  isSending,
  formatTime,
  onResendCode,
  onVerified,
}: StepVerificationProps) {
  const [verificationCode, setVerificationCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode) {
      setCodeError('인증 코드를 입력해주세요.');
      return;
    }
    setIsLoading(true);
    try {
      const result = await authApi.verifyResetCode(email, verificationCode);
      if (result.success) {
        setCodeError('');
        onVerified();
      } else {
        setCodeError(result.error ?? '인증 코드가 올바르지 않습니다.');
      }
    } catch {
      setCodeError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
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
          disabled={isLoading}
        />
        {isActive && (
          <div
            className="absolute right-4 top-11 text-sm font-semibold text-red-500"
            role="timer"
            aria-live={countdown % 30 === 0 ? 'polite' : 'off'}
          >
            {formatTime()}
          </div>
        )}
        {!isActive && (
          <p className="text-sm text-red-500 font-semibold mt-1" aria-live="assertive">
            인증 시간이 만료되었어요. 재전송 버튼을 눌러주세요.
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          size="lg"
          fullWidth
          type="button"
          onClick={onResendCode}
          disabled={isSending || isActive || isLoading}
        >
          {isSending ? '전송 중...' : `재전송${isActive ? ` (${formatTime()})` : ''}`}
        </Button>
        <Button variant="primary" size="lg" fullWidth type="submit" disabled={isLoading}>
          {isLoading ? '확인 중...' : '확인'}
        </Button>
      </div>
    </form>
  );
}
