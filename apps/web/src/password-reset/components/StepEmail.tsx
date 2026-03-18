'use client';

import { useState } from 'react';
import { InputField } from '@/components/form/InputField';
import { Button } from '@/components/Button';
import { StepHeader } from '@/components/StepHeader';
import { validateKnuEmail } from '@/utils/validation';
import { Mail } from 'lucide-react';

interface StepEmailProps {
  email: string;
  onEmailChange: (email: string) => void;
  onSendCode: () => void;
  onGoToLogin: () => void;
}

export function StepEmail({ email, onEmailChange, onSendCode, onGoToLogin }: StepEmailProps) {
  const [emailError, setEmailError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateKnuEmail(email);
    if (error) {
      setEmailError(error);
      return;
    }
    setEmailError('');
    onSendCode();
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <StepHeader
        icon={<Mail className="w-8 h-8 text-[var(--knu-primary)]" />}
        title="비밀번호 찾기"
        description="이메일 주소를 입력하시면 인증 코드를 보내드립니다"
      />

      <InputField
        label="이메일"
        type="email"
        placeholder="example@kangwon.ac.kr"
        value={email}
        onChange={(value) => {
          onEmailChange(value);
          setEmailError('');
        }}
        error={emailError}
      />

      <Button variant="primary" size="lg" fullWidth type="submit">
        인증 코드 전송
      </Button>

      <div className="text-center pt-4">
        <button
          type="button"
          onClick={onGoToLogin}
          className="text-sm font-semibold text-[var(--knu-primary)] hover:text-[var(--knu-primary-hover)] transition-colors"
        >
          로그인으로 돌아가기
        </button>
      </div>
    </form>
  );
}
