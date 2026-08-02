'use client';

import type { FormEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import Link from 'next/link';
import { AuthEmailDeliveryHelp } from '@/auth/components';
import { Button } from '@/components/ui/Button';
import { formatCompactAuthRemainingTime } from '@/auth/components/feedback/AuthRemainingTime';
import { StepHeader } from '@/auth/components/StepHeader';
import { InputField } from '@/auth/components/form/InputField';
import { focusAndScroll } from '@/auth/components/form/focusAndScroll';
import type { PasswordResetActionResult } from '../model/password-reset-flow.types';
import { PASSWORD_RESET_COPY } from '../model/password-reset-copy';

interface PasswordResetVerificationStepProps {
  email: string;
  verificationCode: string;
  countdown: number;
  isActive: boolean;
  isSending: boolean;
  isVerifying: boolean;
  isRateLimited: boolean;
  isAttemptsExhausted: boolean;
  sessionStatus?: ReactNode;
  actionFeedback?: ReactNode;
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
  isRateLimited,
  isAttemptsExhausted,
  sessionStatus,
  actionFeedback,
  onVerificationCodeChange,
  onResendCode,
  onVerifyCode,
  onBackToEmail,
}: PasswordResetVerificationStepProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [codeError, setCodeError] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);
  const isCodeUnavailable = !isActive;
  const isExpired = isCodeUnavailable && !isAttemptsExhausted && !isSending;

  useEffect(() => {
    focusAndScroll(headingRef.current);
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!verificationCode) {
      setCodeError(PASSWORD_RESET_COPY.verification.required);
      focusAndScroll(codeRef.current);
      return;
    }

    const result = await onVerifyCode();
    if (result.success) {
      setCodeError('');
      return;
    }

    const fieldError = result.fieldErrors?.code;
    if (fieldError) {
      setCodeError(fieldError);
      focusAndScroll(codeRef.current);
    } else {
      setCodeError('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        <StepHeader
          headingRef={headingRef}
          icon={<Mail className="h-8 w-8 text-(--knu-primary)" />}
          title={PASSWORD_RESET_COPY.verification.title}
          description={PASSWORD_RESET_COPY.verification.description}
        />
        {sessionStatus}
      </div>

      {actionFeedback}

      <section
        aria-label={PASSWORD_RESET_COPY.verification.requestedAddressLabel}
        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700"
      >
        <p className="text-xs font-semibold text-slate-500">
          {PASSWORD_RESET_COPY.verification.requestedAddressTitle}
        </p>
        <p className="mt-1 break-all text-sm font-semibold text-slate-800">{email}</p>
      </section>

      <div className="relative">
        <InputField
          ref={codeRef}
          label={PASSWORD_RESET_COPY.verification.label}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder={PASSWORD_RESET_COPY.verification.placeholder}
          value={verificationCode}
          onChange={(value) => {
            onVerificationCodeChange(value.replace(/\D/g, '').slice(0, 6));
            setCodeError('');
          }}
          error={codeError}
          maxLength={6}
          disabled={isVerifying || isCodeUnavailable}
          required
        />
        {isExpired && (
          <p className="mt-2 text-sm font-semibold leading-5 text-red-500" aria-live="assertive">
            {PASSWORD_RESET_COPY.verification.expired}
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
          disabled={isSending || isVerifying || isRateLimited || (isActive && !isAttemptsExhausted)}
        >
          {isSending
            ? PASSWORD_RESET_COPY.verification.resending
            : isActive && !isAttemptsExhausted
              ? `${PASSWORD_RESET_COPY.verification.resend} · ${formatCompactAuthRemainingTime(countdown)}`
              : PASSWORD_RESET_COPY.verification.resend}
        </Button>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          type="submit"
          disabled={isSending || isVerifying || isCodeUnavailable || isRateLimited}
        >
          {isVerifying
            ? PASSWORD_RESET_COPY.verification.verifying
            : PASSWORD_RESET_COPY.verification.verify}
        </Button>
      </div>

      <AuthEmailDeliveryHelp onChangeEmailAction={onBackToEmail} />

      <p className="border-t border-slate-200 pt-4 text-center text-xs text-(--knu-text-tertiary)">
        {PASSWORD_RESET_COPY.verification.signupPrefix}{' '}
        <Link
          href="/signup"
          className="font-semibold text-(--knu-primary) underline-offset-4 hover:underline"
        >
          {PASSWORD_RESET_COPY.verification.signup}
        </Link>
      </p>
    </form>
  );
}
