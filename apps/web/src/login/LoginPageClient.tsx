'use client';

import { useCallback } from 'react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthHeader } from '@/components/AuthHeader';
import { useRedirectIfAuthenticated } from '@/hooks/useRedirectIfAuthenticated';
import { LoginForm } from './components/LoginForm';
import { LoginLegalLinks, LoginSignupAction } from './components/LoginSecondaryActions';
import { useLoginForm } from './hooks/useLoginForm';
import { useLoginRedirectTarget } from './hooks/useLoginRedirectTarget';

export default function LoginPageClient() {
  const router = useRouter();
  const { isReadyToRender } = useRedirectIfAuthenticated();
  const redirectTarget = useLoginRedirectTarget();
  const loginForm = useLoginForm({
    redirectTarget,
    onSuccess: (target) => router.replace(target as Route),
  });

  const handlePasswordResetClick = useCallback(() => {
    router.push('/password-reset');
  }, [router]);

  const handleSignupClick = useCallback(() => {
    router.push('/signup');
  }, [router]);

  if (!isReadyToRender) {
    return <div className="min-h-screen bg-[var(--knu-background-alt)]" />;
  }

  return (
    <div className="min-h-screen bg-[var(--knu-background-alt)]">
      <AuthHeader showBack={false} />

      <div className="mx-auto max-w-md px-5 py-12 md:py-20">
        <div className="mb-10 text-center">
          <Image
            src="/knu_logo.svg"
            alt="KNU 로고"
            width={80}
            height={80}
            className="mx-auto mb-6 rounded-full shadow-lg"
          />
          <h1 className="mb-3 text-3xl font-bold text-[var(--knu-text-primary)] md:text-4xl">
            로그인
          </h1>
          <p className="text-[var(--knu-text-secondary)]">KNU 룸메에 오신 것을 환영합니다</p>
          <p className="keep-all mt-2 text-xs text-[var(--knu-text-tertiary)]">
            본 서비스는 강원대학교 공식 서비스가 아닌 독립 운영 서비스입니다.{' '}
            <Link href="/terms" className="underline">
              자세히 보기
            </Link>
          </p>
        </div>

        <LoginForm
          values={loginForm.values}
          fieldErrors={loginForm.fieldErrors}
          uiError={loginForm.uiError}
          isSubmitting={loginForm.isSubmitting}
          isLocked={loginForm.isLocked}
          isSubmitDisabled={loginForm.isSubmitDisabled}
          cooldownLabel={loginForm.cooldownLabel}
          onEmailChange={loginForm.setEmail}
          onPasswordChange={loginForm.setPassword}
          onRememberMeChange={loginForm.setRememberMe}
          onPasswordResetClick={handlePasswordResetClick}
          onSubmit={loginForm.handleSubmit}
        />

        <LoginSignupAction onClick={handleSignupClick} />
        <LoginLegalLinks />
      </div>
    </div>
  );
}
