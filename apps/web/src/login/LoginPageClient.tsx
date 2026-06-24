'use client';

import { useCallback } from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useRedirectIfAuthenticated } from '@/hooks/useRedirectIfAuthenticated';
import { LoginAuthenticatedSkeleton } from './components/LoginAuthenticatedSkeleton';
import { LoginForm } from './components/LoginForm';
import { LoginLayout } from './components/LoginLayout';
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
    return <LoginAuthenticatedSkeleton />;
  }

  return (
    <LoginLayout
      footer={
        <>
          <LoginSignupAction onClick={handleSignupClick} />
          <LoginLegalLinks />
        </>
      }
    >
      <LoginForm
        values={loginForm.values}
        fieldErrors={loginForm.fieldErrors}
        uiError={loginForm.uiError}
        isSubmitting={loginForm.isSubmitting}
        isLocked={loginForm.isLocked}
        isSubmitDisabled={loginForm.isSubmitDisabled}
        cooldownLabel={loginForm.cooldownLabel}
        lastInvalidField={loginForm.lastInvalidField}
        invalidSubmitCount={loginForm.invalidSubmitCount}
        onEmailChange={loginForm.setEmail}
        onPasswordChange={loginForm.setPassword}
        onRememberMeChange={loginForm.setRememberMe}
        onPasswordResetClick={handlePasswordResetClick}
        onSubmit={loginForm.handleSubmit}
      />
    </LoginLayout>
  );
}
