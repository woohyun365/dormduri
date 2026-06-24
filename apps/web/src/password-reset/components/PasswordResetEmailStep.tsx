'use client';

import type { FormEvent } from 'react';
import { useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/Button';
import { StepHeader } from '@/components/StepHeader';
import { InputField } from '@/components/form/InputField';
import { focusAndScroll } from '@/utils/focus';
import { validateKnuEmail } from '@/utils/validation';

interface PasswordResetEmailStepProps {
  email: string;
  onEmailChange: (email: string) => void;
  onSendCode: () => void;
  onGoToLogin: () => void;
}

export function PasswordResetEmailStep({
  email,
  onEmailChange,
  onSendCode,
  onGoToLogin,
}: PasswordResetEmailStepProps) {
  const [emailError, setEmailError] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
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
      <StepHeader
        icon={<Mail className="h-8 w-8 text-[var(--knu-primary)]" />}
        title="비밀번호 찾기"
        description="이메일 주소를 입력하시면 인증 코드를 보내드립니다"
      />

      <InputField
        ref={emailRef}
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

      <div className="pt-4 text-center">
        <button
          type="button"
          onClick={onGoToLogin}
          className="text-sm font-semibold text-[var(--knu-primary)] transition-colors hover:text-[var(--knu-primary-hover)]"
        >
          로그인으로 돌아가기
        </button>
      </div>
    </form>
  );
}
