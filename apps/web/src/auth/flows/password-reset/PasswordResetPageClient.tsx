'use client';

import { PasswordResetEmailStep } from './components/PasswordResetEmailStep';
import { PasswordResetLayout } from './components/PasswordResetLayout';
import { PasswordResetVerificationStep } from './components/PasswordResetVerificationStep';
import { PasswordResetNewPasswordStep } from './components/PasswordResetNewPasswordStep';
import { PasswordResetCompleteStep } from './components/PasswordResetCompleteStep';
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
    <PasswordResetLayout
      currentStep={stepNumber}
      showBack={state.step !== 'email' && state.step !== 'complete'}
      showProgress={state.step !== 'complete'}
      status={status}
      isAuthenticated={isAuthenticated}
      isSessionUnavailable={isSessionUnavailable}
      onBack={actions.goBack}
      onRestart={actions.restartEmailEntry}
      onRetrySession={retrySession}
    >
      {state.step === 'email' && (
        <PasswordResetEmailStep
          email={state.email}
          isSending={state.isSendingCode}
          onEmailChange={actions.changeEmail}
          onSendCode={actions.sendCode}
          onGoToLogin={actions.goToLogin}
        />
      )}
      {state.step === 'verification' && (
        <PasswordResetVerificationStep
          email={state.requestedEmail || state.email}
          verificationCode={state.verificationCode}
          countdown={cooldown.countdown}
          isActive={cooldown.isActive}
          isSending={state.isSendingCode}
          isVerifying={state.isVerifyingCode}
          formatTime={cooldown.formatTime}
          onVerificationCodeChange={actions.changeVerificationCode}
          onResendCode={actions.sendCode}
          onVerifyCode={actions.verifyCode}
          onBackToEmail={actions.restartEmailEntry}
        />
      )}
      {state.step === 'newPassword' && (
        <PasswordResetNewPasswordStep
          email={state.requestedEmail || state.email}
          newPassword={state.newPassword}
          confirmPassword={state.confirmPassword}
          isResetting={state.isResettingPassword}
          onNewPasswordChange={actions.changeNewPassword}
          onConfirmPasswordChange={actions.changeConfirmPassword}
          onResetPassword={actions.resetPassword}
        />
      )}
      {state.step === 'complete' && (
        <PasswordResetCompleteStep onGoToLogin={actions.goToLoginAfterReset} />
      )}
    </PasswordResetLayout>
  );
}
