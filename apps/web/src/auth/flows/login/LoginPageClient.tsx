'use client';

import { useCallback } from 'react';
import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRedirectIfAuthenticated } from '@/auth/hooks';
import { LoginFlowView } from './LoginFlowView';
import { LoginSessionTransition } from './components/LoginSessionTransition';
import { useLoginForm } from './hooks/useLoginForm';
import { useLoginRedirectTarget } from './hooks/useLoginRedirectTarget';
import { mapLoginRouteStatus } from './model/login-route-status';

export default function LoginPageClient() {
  const router = useRouter();
  const { isReadyToRender, sessionStatus, retrySession } = useRedirectIfAuthenticated();
  const searchParams = useSearchParams();
  const redirectTarget = useLoginRedirectTarget();
  const routeStatus = mapLoginRouteStatus(searchParams);
  const sessionTransitionState = !isReadyToRender
    ? sessionStatus === 'authenticated'
      ? 'redirecting'
      : 'checking'
    : null;
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

  return (
    <LoginFlowView
      sessionTransitionState={sessionTransitionState}
      isSessionUnavailable={sessionStatus === 'unavailable'}
      values={loginForm.values}
      fieldErrors={loginForm.fieldErrors}
      uiError={loginForm.uiError}
      routeStatus={routeStatus}
      isSubmitting={loginForm.isSubmitting}
      isRedirecting={loginForm.redirectState.isRedirecting}
      isLocked={loginForm.isLocked}
      isSubmitDisabled={loginForm.isSubmitDisabled}
      cooldownLabel={loginForm.cooldownLabel}
      lastInvalidField={loginForm.lastInvalidField}
      invalidSubmitCount={loginForm.invalidSubmitCount}
      onEmailChangeAction={loginForm.setEmail}
      onPasswordChangeAction={loginForm.setPassword}
      onRememberMeChangeAction={loginForm.setRememberMe}
      onPasswordResetAction={handlePasswordResetClick}
      onSignupAction={handleSignupClick}
      onSubmitAction={loginForm.handleSubmit}
      onRetrySessionAction={retrySession}
    />
  );
}

export function LoginPageFallback() {
  return <LoginSessionTransition state="checking" />;
}
