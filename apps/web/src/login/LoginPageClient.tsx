'use client';

import { useCallback } from 'react';
import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRedirectIfAuthenticated } from '@/hooks/useRedirectIfAuthenticated';
import { LoginAuthenticatedSkeleton } from './components/LoginAuthenticatedSkeleton';
import { LoginForm } from './components/LoginForm';
import { LoginRouteStatusAlert } from './components/LoginRouteStatusAlert';
import { LoginLayout } from './components/LoginLayout';
import { LoginLegalLinks, LoginSignupAction } from './components/LoginSecondaryActions';
import { useLoginForm } from './hooks/useLoginForm';
import { useLoginRedirectTarget } from './hooks/useLoginRedirectTarget';
import { mapLoginRouteStatus } from './model/login-route-status';

export default function LoginPageClient() {
  const router = useRouter();
  const { isReadyToRender } = useRedirectIfAuthenticated();
  const searchParams = useSearchParams();
  const redirectTarget = useLoginRedirectTarget();
  const routeStatus = mapLoginRouteStatus(searchParams);
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
      <LoginRouteStatusAlert status={loginForm.uiError ? null : routeStatus} />
      <LoginForm
        values={loginForm.values}
        fieldErrors={loginForm.fieldErrors}
        uiError={loginForm.uiError}
        isSubmitting={loginForm.isSubmitting}
        isRedirecting={loginForm.redirectState.isRedirecting}
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
