'use client';

import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { StepHeader } from '@/auth/components/StepHeader';
import { InputField } from '@/auth/components/form/InputField';
import { focusAndScroll } from '@/auth/components/form/focusAndScroll';
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
      />

      <section
        role="status"
        aria-live="polite"
        className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 text-emerald-950"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-sm font-bold">인증 코드 안내</h3>
            <p className="text-sm leading-6">
              <span className="block break-all">발송 완료: {email}</span>
            </p>
          </div>
        </div>
      </section>

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
