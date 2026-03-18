'use client';

import { useState } from 'react';
import { InputField } from '@/components/form/InputField';
import { Button } from '@/components/Button';
import { StepHeader } from '@/components/StepHeader';

import { authApi } from '@/api/auth';
import { Mail } from 'lucide-react';
import Link from 'next/link';

interface StepVerificationProps {
  email: string;
  countdown: number;
  isActive: boolean;
  isSending: boolean;
  formatTime: () => string;
  onResendCode: () => void;
  onVerified: () => void;
  onBackToEmail: () => void;
}

export function StepVerification({
  email,
  countdown,
  isActive,
  isSending,
  formatTime,
  onResendCode,
  onVerified,
  onBackToEmail,
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
        description="해당 이메일로 가입된 계정이 있다면 인증 코드가 전송됩니다"
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

      <div className="pt-2 space-y-2 text-center">
        <p className="text-xs text-[var(--knu-text-tertiary)]">
          메일이 도착하지 않나요? 스팸 폴더를 확인하거나 이메일 주소를 다시 확인해주세요.
        </p>
        <div className="flex justify-center gap-4 text-sm">
          <button
            type="button"
            onClick={onBackToEmail}
            className="font-semibold text-[var(--knu-primary)] hover:text-[var(--knu-primary-hover)] transition-colors"
          >
            이메일 다시 입력
          </button>
          <span className="text-[var(--knu-text-tertiary)]">|</span>
          <Link
            href="/signup"
            className="font-semibold text-[var(--knu-primary)] hover:text-[var(--knu-primary-hover)] transition-colors"
          >
            회원가입
          </Link>
        </div>
      </div>
    </form>
  );
}
