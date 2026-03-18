'use client';

import { useState } from 'react';
import { InputField } from '@/components/form/InputField';
import { Button } from '@/components/Button';
import { StepHeader } from '@/components/StepHeader';
import { validatePassword, validatePasswordConfirm } from '@/utils/validation';
import { PasswordRequirementList } from '@/components/auth/PasswordRequirementList';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '@/constants/auth';
import { authApi } from '@/api/auth';
import { AlertCircle, Lock } from 'lucide-react';

interface StepNewPasswordProps {
  email: string;
  onResetComplete: () => void;
}

export function StepNewPassword({ email, onResetComplete }: StepNewPasswordProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pwError = validatePassword(newPassword, email);
    const cfError = validatePasswordConfirm(newPassword, confirmPassword);

    setPasswordError(pwError);
    setConfirmError(cfError);

    if (pwError || cfError) {
      return;
    }

    setIsLoading(true);
    setSubmitError('');
    try {
      const result = await authApi.resetPassword(email, newPassword);
      if (result.success) {
        onResetComplete();
      } else {
        setSubmitError(result.error ?? '비밀번호 재설정에 실패했습니다. 다시 시도해주세요.');
      }
    } catch {
      setSubmitError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <StepHeader
        icon={<Lock className="w-8 h-8 text-[var(--knu-primary)]" />}
        title="새 비밀번호 설정"
        description="기존과 다른 새 비밀번호를 입력해주세요"
      />

      {submitError && (
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-900 font-medium">{submitError}</p>
        </div>
      )}

      <div>
        <InputField
          label="새 비밀번호"
          type="password"
          placeholder={`영문, 숫자 포함 ${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자`}
          value={newPassword}
          onChange={(value) => {
            setNewPassword(value);
            setPasswordError('');
          }}
          error={passwordError}
          disabled={isLoading}
        />
        <PasswordRequirementList password={newPassword} email={email} />
      </div>

      <InputField
        label="비밀번호 확인"
        type="password"
        placeholder="비밀번호를 다시 입력해주세요"
        value={confirmPassword}
        onChange={(value) => {
          setConfirmPassword(value);
          setConfirmError('');
        }}
        error={confirmError}
        disabled={isLoading}
      />

      <Button variant="primary" size="lg" fullWidth type="submit" disabled={isLoading}>
        {isLoading ? '처리 중...' : '비밀번호 재설정'}
      </Button>
    </form>
  );
}
