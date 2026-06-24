'use client';

import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { StepHeader } from '@/components/StepHeader';
import { InputField } from '@/components/form/InputField';
import { focusAndScroll } from '@/utils/focus';
import { validateKnuEmail } from '@/utils/validation';

interface PasswordResetEmailStepProps {
  email: string;
  isSending: boolean;
  onEmailChange: (email: string) => void;
  onSendCode: () => void;
  onGoToLogin: () => void;
}

export function PasswordResetEmailStep({
  email,
  isSending,
  onEmailChange,
  onSendCode,
  onGoToLogin,
}: PasswordResetEmailStepProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [emailError, setEmailError] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    focusAndScroll(headingRef.current);
  }, []);

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
        headingRef={headingRef}
        icon={<Mail className="h-8 w-8 text-(--knu-primary)" />}
        title="비밀번호 찾기"
        description="가입된 계정이 있는 경우에만 인증 코드가 발송돼요"
      />

      <InputField
        ref={emailRef}
        label="학교 이메일"
        type="email"
        autoComplete="email"
        placeholder="example@kangwon.ac.kr"
        value={email}
        onChange={(value) => {
          onEmailChange(value);
          setEmailError('');
        }}
        error={emailError}
        disabled={isSending}
        required
      />

      <div className="rounded-2xl bg-(--knu-background-alt) p-4 text-sm leading-6 text-(--knu-text-secondary)">
        계정 존재 여부는 화면에 표시하지 않습니다. 메일이 오지 않으면 주소를 다시 확인하거나 잠시 후
        재시도해주세요.
      </div>

      <Button variant="primary" size="lg" fullWidth type="submit" disabled={isSending}>
        {isSending ? '전송 중...' : '인증 코드 전송'}
      </Button>

      <div className="flex flex-col items-center gap-2 pt-2 text-sm sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={onGoToLogin}
          className="font-semibold text-(--knu-primary) transition-colors hover:text-(--knu-primary-hover)"
        >
          로그인으로 돌아가기
        </button>
        <span className="hidden text-(--knu-text-tertiary) sm:inline" aria-hidden="true">
          ·
        </span>
        <Link
          href="/signup"
          className="font-semibold text-(--knu-text-secondary) underline-offset-4 hover:underline"
        >
          계정이 없으면 회원가입
        </Link>
      </div>
    </form>
  );
}
