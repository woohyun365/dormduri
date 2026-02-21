'use client';

import { useState } from 'react';
import { InputField } from '@/components/form/InputField';
import { Button } from '@/components/Button';
import { StepHeader } from '@/components/StepHeader';
import { validatePassword, validatePasswordConfirm } from '@/utils/validation';
import { Lock } from 'lucide-react';

interface StepNewPasswordProps {
  onResetComplete: () => void;
}

export function StepNewPassword({ onResetComplete }: StepNewPasswordProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pwError = validatePassword(newPassword);
    const cfError = validatePasswordConfirm(newPassword, confirmPassword);

    setPasswordError(pwError);
    setConfirmError(cfError);

    if (!pwError && !cfError) {
      onResetComplete();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <StepHeader
        icon={<Lock className="w-8 h-8 text-[var(--knu-primary)]" />}
        title="새 비밀번호 설정"
        description="새로운 비밀번호를 입력해주세요"
      />

      <InputField
        label="새 비밀번호"
        type="password"
        placeholder="영문, 숫자 포함 8자 이상"
        value={newPassword}
        onChange={(value) => {
          setNewPassword(value);
          setPasswordError('');
        }}
        error={passwordError}
      />

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
      />

      <Button variant="primary" size="lg" fullWidth type="submit">
        비밀번호 재설정
      </Button>
    </form>
  );
}
