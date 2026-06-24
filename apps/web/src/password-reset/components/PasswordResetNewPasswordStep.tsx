'use client';

import type { FormEvent } from 'react';
import { useRef, useState } from 'react';
import { AlertCircle, Lock } from 'lucide-react';
import { Button } from '@/components/Button';
import { PasswordRequirementList } from '@/components/auth/PasswordRequirementList';
import { StepHeader } from '@/components/StepHeader';
import { InputField } from '@/components/form/InputField';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/constants/auth';
import { focusAndScroll } from '@/utils/focus';
import { validatePassword, validatePasswordConfirm } from '@/utils/validation';

interface PasswordResetActionResult {
  success: boolean;
  error?: string;
}

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
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

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
      setSubmitError(result.error || '비밀번호 재설정에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <StepHeader
        icon={<Lock className="h-8 w-8 text-[var(--knu-primary)]" />}
        title="새 비밀번호 설정"
        description="기존과 다른 새 비밀번호를 입력해주세요"
      />

      {submitError && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <p className="text-sm font-medium text-red-900">{submitError}</p>
        </div>
      )}

      <div>
        <InputField
          ref={passwordRef}
          label="새 비밀번호"
          type="password"
          placeholder={`영문, 숫자 포함 ${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자`}
          value={newPassword}
          onChange={(value) => {
            onNewPasswordChange(value);
            setPasswordError('');
          }}
          error={passwordError}
          disabled={isResetting}
        />
        <PasswordRequirementList password={newPassword} email={email} />
      </div>

      <InputField
        ref={confirmRef}
        label="비밀번호 확인"
        type="password"
        placeholder="비밀번호를 다시 입력해주세요"
        value={confirmPassword}
        onChange={(value) => {
          onConfirmPasswordChange(value);
          setConfirmError('');
        }}
        error={confirmError}
        disabled={isResetting}
      />

      <Button variant="primary" size="lg" fullWidth type="submit" disabled={isResetting}>
        {isResetting ? '처리 중...' : '비밀번호 재설정'}
      </Button>
    </form>
  );
}
