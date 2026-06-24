'use client';

import { AuthHeader } from '@/components/AuthHeader';
import { ProgressBar } from '@/components/form/ProgressBar';
import { PasswordResetEmailStep } from './components/PasswordResetEmailStep';
import { PasswordResetVerificationStep } from './components/PasswordResetVerificationStep';
import { PasswordResetNewPasswordStep } from './components/PasswordResetNewPasswordStep';
import { PasswordResetCompleteStep } from './components/PasswordResetCompleteStep';
import { usePasswordResetFlow } from './hooks/usePasswordResetFlow';

export default function PasswordResetPageClient() {
  const { state, stepNumber, cooldown, actions } = usePasswordResetFlow();

  return (
    <div className="min-h-screen bg-[var(--knu-background-alt)]">
      <AuthHeader
        showBack={state.step !== 'email' && state.step !== 'complete'}
        onBack={actions.goBack}
      />

      <div className="mx-auto max-w-md px-5 py-12 md:py-16">
        {state.step !== 'complete' && (
          <div className="mb-8">
            <ProgressBar currentStep={stepNumber} totalSteps={3} />
          </div>
        )}

        <div className="rounded-2xl border-2 border-[var(--knu-border)] bg-white p-6 shadow-sm md:p-8">
          {state.step === 'email' && (
            <PasswordResetEmailStep
              email={state.email}
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
            <PasswordResetCompleteStep onGoToLogin={actions.goToLogin} />
          )}
        </div>
      </div>
    </div>
  );
}
