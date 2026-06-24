'use client';

import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { StepHeader } from '@/components/StepHeader';
import { InputField } from '@/components/form/InputField';
import { focusAndScroll } from '@/utils/focus';
import type { PasswordResetActionResult } from '../model/password-reset-flow.types';

interface PasswordResetVerificationStepProps {
  email: string;
  verificationCode: string;
  countdown: number;
  isActive: boolean;
  isSending: boolean;
  isVerifying: boolean;
  formatTime: () => string;
  onVerificationCodeChange: (verificationCode: string) => void;
  onResendCode: () => void;
  onVerifyCode: () => Promise<PasswordResetActionResult>;
  onBackToEmail: () => void;
}

export function PasswordResetVerificationStep({
  email,
  verificationCode,
  countdown,
  isActive,
  isSending,
  isVerifying,
  formatTime,
  onVerificationCodeChange,
  onResendCode,
  onVerifyCode,
  onBackToEmail,
}: PasswordResetVerificationStepProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [codeError, setCodeError] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);
  const isExpired = !isActive;

  useEffect(() => {
    focusAndScroll(headingRef.current);
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!verificationCode) {
      setCodeError('인증 코드를 입력해주세요.');
      focusAndScroll(codeRef.current);
      return;
    }

    const result = await onVerifyCode();
    if (result.success) {
      setCodeError('');
      return;
    }

    const fieldError = result.fieldErrors?.code;
    setCodeError(fieldError ?? result.error ?? '인증 코드가 올바르지 않습니다.');
    focusAndScroll(codeRef.current);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <StepHeader
        headingRef={headingRef}
        icon={<Mail className="h-8 w-8 text-(--knu-primary)" />}
        title="인증 코드 확인"
        description={`${email} 메일함에서 6자리 코드를 확인해주세요`}
      />

      <div className="relative">
        <InputField
          ref={codeRef}
          label="인증 코드"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6자리 인증 코드"
          value={verificationCode}
          onChange={(value) => {
            onVerificationCodeChange(value.replace(/\D/g, '').slice(0, 6));
            setCodeError('');
          }}
          error={codeError}
          maxLength={6}
          disabled={isVerifying}
          required
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
        {isExpired && (
          <p className="mt-2 text-sm font-semibold text-red-500" aria-live="assertive">
            인증 시간이 만료됐어요. 재전송으로 새 코드를 받아주세요.
          </p>
        )}
      </div>

      {isActive && (
        <p className="keep-all rounded-2xl bg-(--knu-background-alt) p-4 text-sm leading-6 text-(--knu-text-secondary)">
          인증 코드는 {formatTime()} 동안 사용할 수 있어요. 보안을 위해 재전송은 만료 후에만
          가능합니다.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="outline"
          size="lg"
          fullWidth
          type="button"
          onClick={onResendCode}
          disabled={isSending || isActive || isVerifying}
        >
          {isSending ? '전송 중...' : `재전송${isActive ? ` (${formatTime()})` : ''}`}
        </Button>
        <Button variant="primary" size="lg" fullWidth type="submit" disabled={isVerifying}>
          {isVerifying ? '확인 중...' : '확인'}
        </Button>
      </div>

      <div className="space-y-1.5 pt-2 text-xs text-(--knu-text-tertiary)">
        <p className="font-medium text-(--knu-text-secondary)">메일이 도착하지 않나요?</p>
        <ul className="space-y-1">
          <li>· 스팸 메일함을 확인해주세요.</li>
          <li>
            · 이메일 주소가 잘못됐다면{' '}
            <button
              type="button"
              onClick={onBackToEmail}
              className="font-semibold text-(--knu-primary) transition-colors hover:text-(--knu-primary-hover)"
            >
              다시 입력하기
            </button>
          </li>
          <li>
            · 아직 계정이 없다면{' '}
            <Link
              href="/signup"
              className="font-semibold text-(--knu-primary) transition-colors hover:text-(--knu-primary-hover)"
            >
              회원가입
            </Link>
          </li>
        </ul>
      </div>
    </form>
  );
}
