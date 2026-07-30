'use client';

import { PasswordResetFlowView } from './PasswordResetFlowView';
import { usePasswordResetFlow } from './hooks/usePasswordResetFlow';

export default function PasswordResetPageClient() {
  const {
    state,
    stepNumber,
    cooldown,
    status,
    isAuthenticated,
    isSessionUnavailable,
    retrySession,
    actions,
  } = usePasswordResetFlow();

  return (
    <PasswordResetFlowView
      state={state}
      stepNumber={stepNumber}
      countdown={cooldown}
      status={status}
      isAuthenticated={isAuthenticated}
      isSessionUnavailable={isSessionUnavailable}
      onBackAction={actions.goBack}
      onRestartAction={actions.restartEmailEntry}
      onEmailChangeAction={actions.changeEmail}
      onSendCodeAction={actions.sendCode}
      onGoToLoginAction={actions.goToLogin}
      onVerificationCodeChangeAction={actions.changeVerificationCode}
      onVerifyCodeAction={actions.verifyCode}
      onNewPasswordChangeAction={actions.changeNewPassword}
      onConfirmPasswordChangeAction={actions.changeConfirmPassword}
      onResetPasswordAction={actions.resetPassword}
      onGoToLoginAfterResetAction={actions.goToLoginAfterReset}
      onRetrySessionAction={retrySession}
    />
  );
}
