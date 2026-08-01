'use client';

import { AuthSessionTransition } from '@/auth/components';
import { useRedirectIfAuthenticated } from '@/auth/hooks';
import { PasswordResetFlowView } from './PasswordResetFlowView';
import { usePasswordResetFlow } from './hooks/usePasswordResetFlow';

export default function PasswordResetPageClient() {
  const { isReadyToRender, sessionStatus, retrySession } = useRedirectIfAuthenticated();
  const { state, codeExpiry, status, actions } = usePasswordResetFlow();

  if (!isReadyToRender) {
    return (
      <AuthSessionTransition
        state={sessionStatus === 'authenticated' ? 'redirecting' : 'checking'}
      />
    );
  }

  return (
    <PasswordResetFlowView
      state={state}
      countdown={codeExpiry}
      status={status}
      isSessionUnavailable={sessionStatus === 'unavailable'}
      onBackAction={actions.goBack}
      onRestartAction={actions.restartEmailEntry}
      onEmailChangeAction={actions.changeEmail}
      onSendCodeAction={actions.sendCode}
      onGoToLoginAction={actions.goToLogin}
      onVerificationCodeChangeAction={actions.changeVerificationCode}
      onVerifyCodeAction={actions.verifyCode}
      onContinueAfterVerificationAction={actions.continueAfterVerification}
      onNewPasswordChangeAction={actions.changeNewPassword}
      onConfirmPasswordChangeAction={actions.changeConfirmPassword}
      onResetPasswordAction={actions.resetPassword}
      onGoToLoginAfterResetAction={actions.goToLoginAfterReset}
      onRetrySessionAction={retrySession}
    />
  );
}
