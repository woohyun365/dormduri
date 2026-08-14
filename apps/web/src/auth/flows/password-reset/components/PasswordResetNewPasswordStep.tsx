'use client';

import type { FormEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PasswordRequirementList } from '@/auth/components';
import { VerifiedSchoolEmailCard } from '@/auth/components/VerifiedSchoolEmailCard';
import { StepHeader } from '@/auth/components/StepHeader';
import { InputField } from '@/auth/components/form/InputField';
import { focusAndScroll } from '@/auth/components/form/focusAndScroll';
import { validatePasswordConfirm } from '@/auth/model/authFormValidation';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePasswordStructure as validatePassword,
} from '@repo/shared/auth/policy';
import type { PasswordResetActionResult } from '../model/password-reset-flow.types';
import { PASSWORD_RESET_COPY } from '../model/password-reset-copy';

interface PasswordResetNewPasswordStepProps {
  email: string;
  newPassword: string;
  confirmPassword: string;
  isResetting: boolean;
  isRateLimited: boolean;
  sessionStatus?: ReactNode;
  actionFeedback?: ReactNode;
  onNewPasswordChange: (newPassword: string) => void;
  onConfirmPasswordChange: (confirmPassword: string) => void;
  onResetPassword: () => Promise<PasswordResetActionResult>;
}

export function PasswordResetNewPasswordStep({
  email,
  newPassword,
  confirmPassword,
  isResetting,
  isRateLimited,
  sessionStatus,
  actionFeedback,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onResetPassword,
}: PasswordResetNewPasswordStepProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    focusAndScroll(headingRef.current);
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const pwError = validatePassword(newPassword, email);
    const cfError = validatePasswordConfirm(newPassword, confirmPassword);

    setPasswordError(pwError);
    setConfirmError(cfError);

    if (pwError || cfError) {
      if (pwError) {
        focusAndScroll(passwordRef.current);
      } else if (cfError) {
        focusAndScroll(confirmRef.current);
      }
      return;
    }

    const result = await onResetPassword();
    if (!result.success) {
      if (result.fieldErrors?.newPassword) {
        setPasswordError(result.fieldErrors.newPassword);
        focusAndScroll(passwordRef.current);
        return;
      }

      if (result.restartRequired) {
        return;
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        <StepHeader
          headingRef={headingRef}
          icon={<Lock className="h-8 w-8 text-(--knu-primary)" />}
          title={PASSWORD_RESET_COPY.newPassword.title}
          description={PASSWORD_RESET_COPY.newPassword.description}
        />
        {sessionStatus}
      </div>

      {actionFeedback}

      <VerifiedSchoolEmailCard email={email} />

      <InputField
        ref={passwordRef}
        label={PASSWORD_RESET_COPY.newPassword.label}
        type="password"
        autoComplete="new-password"
        placeholder={`${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자 입력`}
        value={newPassword}
        onChange={(value) => {
          onNewPasswordChange(value);
          setPasswordError('');
        }}
        error={passwordError}
        disabled={isResetting}
        required
      />

      <InputField
        ref={confirmRef}
        label={PASSWORD_RESET_COPY.newPassword.confirmLabel}
        type="password"
        autoComplete="new-password"
        placeholder={PASSWORD_RESET_COPY.newPassword.confirmPlaceholder}
        value={confirmPassword}
        onChange={(value) => {
          onConfirmPasswordChange(value);
          setConfirmError('');
        }}
        error={confirmError}
        disabled={isResetting}
        required
      />

      <PasswordRequirementList
        password={newPassword}
        email={email}
        confirmPassword={confirmPassword}
      />

      <Button
        variant="primary"
        size="lg"
        fullWidth
        type="submit"
        disabled={isResetting || isRateLimited}
      >
        {isResetting
          ? PASSWORD_RESET_COPY.newPassword.submitting
          : PASSWORD_RESET_COPY.newPassword.submit}
      </Button>
    </form>
  );
}
