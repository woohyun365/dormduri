'use client';

import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Lock } from 'lucide-react';
import { Button } from '@/components/Button';
import { PasswordRequirementList } from '@/auth/components';
import { StepHeader } from '@/components/StepHeader';
import { InputField } from '@/components/form/InputField';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/auth/model';
import { focusAndScroll } from '@/utils/focus';
import { validatePassword, validatePasswordConfirm } from '@/utils/validation';
import type { PasswordResetActionResult } from '../model/password-reset-flow.types';

interface PasswordResetNewPasswordStepProps {
  email: string;
  newPassword: string;
  confirmPassword: string;
  isResetting: boolean;
  onNewPasswordChange: (newPassword: string) => void;
  onConfirmPasswordChange: (confirmPassword: string) => void;
  onResetPassword: () => Promise<PasswordResetActionResult>;
}

export function PasswordResetNewPasswordStep({
  email,
  newPassword,
  confirmPassword,
  isResetting,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onResetPassword,
}: PasswordResetNewPasswordStepProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [submitError, setSubmitError] = useState('');
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

    setSubmitError('');
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

      setSubmitError(result.error || '비밀번호 재설정에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <StepHeader
        headingRef={headingRef}
        icon={<Lock className="h-8 w-8 text-(--knu-primary)" />}
        title="새 비밀번호 설정"
        description="기존과 다른 새 비밀번호를 입력해주세요"
      />

      {submitError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border-2 border-red-200 bg-red-50 p-4"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <p className="text-sm font-medium text-red-900">{submitError}</p>
        </div>
      )}

      <div>
        <InputField
          ref={passwordRef}
          label="새 비밀번호"
          type="password"
          autoComplete="new-password"
          placeholder={`영문, 숫자 포함 ${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자`}
          value={newPassword}
          onChange={(value) => {
            onNewPasswordChange(value);
            setPasswordError('');
            setSubmitError('');
          }}
          error={passwordError}
          disabled={isResetting}
          required
        />
        <PasswordRequirementList password={newPassword} email={email} />
      </div>

      <InputField
        ref={confirmRef}
        label="비밀번호 확인"
        type="password"
        autoComplete="new-password"
        placeholder="비밀번호를 다시 입력해주세요"
        value={confirmPassword}
        onChange={(value) => {
          onConfirmPasswordChange(value);
          setConfirmError('');
          setSubmitError('');
        }}
        error={confirmError}
        disabled={isResetting}
        required
      />

      <Button variant="primary" size="lg" fullWidth type="submit" disabled={isResetting}>
        {isResetting ? '처리 중...' : '비밀번호 재설정'}
      </Button>
    </form>
  );
}
