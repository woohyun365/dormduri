'use client';

import type { FormEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle, Mail } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { StepHeader } from '@/auth/components/StepHeader';
import { InputField } from '@/auth/components/form/InputField';
import { focusAndScroll } from '@/auth/components/form/focusAndScroll';
import { validateKnuEmailFormat as validateKnuEmail } from '@repo/shared/auth/policy';
import { PASSWORD_RESET_COPY } from '../model/password-reset-copy';

interface PasswordResetEmailStepProps {
  email: string;
  isVerified: boolean;
  isSending: boolean;
  isRateLimited: boolean;
  sessionStatus?: ReactNode;
  actionFeedback?: ReactNode;
  onEmailChange: (email: string) => void;
  onSendCode: () => void;
  onGoToLogin: () => void;
  onContinue: () => void;
}

export function PasswordResetEmailStep({
  email,
  isVerified,
  isSending,
  isRateLimited,
  sessionStatus,
  actionFeedback,
  onEmailChange,
  onSendCode,
  onGoToLogin,
  onContinue,
}: PasswordResetEmailStepProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [emailError, setEmailError] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    focusAndScroll(headingRef.current);
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isVerified) {
      onContinue();
      return;
    }
    const error = validateKnuEmail(email);
    if (error) {
      setEmailError(error);
      focusAndScroll(emailRef.current);
      return;
    }
    setEmailError('');
    onSendCode();
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div className="space-y-3">
        <StepHeader
          headingRef={headingRef}
          icon={<Mail className="h-8 w-8 text-(--knu-primary)" />}
          title={PASSWORD_RESET_COPY.email.title}
          description={PASSWORD_RESET_COPY.email.description}
        />
        {sessionStatus}
      </div>

      {actionFeedback}

      <div className="relative">
        <InputField
          ref={emailRef}
          label={PASSWORD_RESET_COPY.email.label}
          type="email"
          autoComplete="email"
          placeholder={PASSWORD_RESET_COPY.email.placeholder}
          value={email}
          onChange={(value) => {
            onEmailChange(value);
            setEmailError('');
          }}
          error={emailError}
          disabled={isSending || isVerified}
          inputClassName={isVerified ? 'truncate pr-28' : undefined}
          required
        />
        {isVerified && (
          <div className="absolute right-4 top-11 flex items-center gap-1 text-green-600">
            <CheckCircle className="size-5" aria-hidden="true" />
            <span className="text-sm font-semibold">{PASSWORD_RESET_COPY.email.verified}</span>
          </div>
        )}
      </div>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        type="submit"
        disabled={isSending || isRateLimited}
      >
        {isVerified
          ? PASSWORD_RESET_COPY.email.next
          : isSending
            ? PASSWORD_RESET_COPY.email.submitting
            : PASSWORD_RESET_COPY.email.submit}
      </Button>

      {!isVerified && (
        <div className="flex flex-col items-center gap-2 pt-2 text-sm sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onGoToLogin}
            className="font-semibold text-(--knu-primary) transition-colors hover:text-(--knu-primary-hover)"
          >
            {PASSWORD_RESET_COPY.email.login}
          </button>
          <span className="hidden text-(--knu-text-tertiary) sm:inline" aria-hidden="true">
            ·
          </span>
          <Link
            href="/signup"
            className="font-semibold text-(--knu-text-secondary) underline-offset-4 hover:underline"
          >
            {PASSWORD_RESET_COPY.email.signupPrefix} {PASSWORD_RESET_COPY.email.signup}
          </Link>
        </div>
      )}
    </form>
  );
}
