import { PasswordResetEmailStep } from './components/PasswordResetEmailStep';
import { PasswordResetLayout } from './components/PasswordResetLayout';
import { PasswordResetVerificationStep } from './components/PasswordResetVerificationStep';
import { PasswordResetNewPasswordStep } from './components/PasswordResetNewPasswordStep';
import { PasswordResetCompleteStep } from './components/PasswordResetCompleteStep';
import type {
  PasswordResetActionResult,
  PasswordResetFlowState,
  PasswordResetStatus,
} from './model/password-reset-flow.types';

interface PasswordResetFlowViewProps {
  state: PasswordResetFlowState;
  stepNumber: number;
  countdown: {
    countdown: number;
    isActive: boolean;
    formatTime: () => string;
  };
  status: PasswordResetStatus | null;
  isAuthenticated: boolean;
  isSessionUnavailable: boolean;
  onBackAction: () => void;
  onRestartAction: () => void;
  onEmailChangeAction: (email: string) => void;
  onSendCodeAction: () => void;
  onGoToLoginAction: () => void;
  onVerificationCodeChangeAction: (verificationCode: string) => void;
  onVerifyCodeAction: () => Promise<PasswordResetActionResult>;
  onNewPasswordChangeAction: (newPassword: string) => void;
  onConfirmPasswordChangeAction: (confirmPassword: string) => void;
  onResetPasswordAction: () => Promise<PasswordResetActionResult>;
  onGoToLoginAfterResetAction: () => void;
  onRetrySessionAction: () => void;
}

export function PasswordResetFlowView({
  state,
  stepNumber,
  countdown,
  status,
  isAuthenticated,
  isSessionUnavailable,
  onBackAction,
  onRestartAction,
  onEmailChangeAction,
  onSendCodeAction,
  onGoToLoginAction,
  onVerificationCodeChangeAction,
  onVerifyCodeAction,
  onNewPasswordChangeAction,
  onConfirmPasswordChangeAction,
  onResetPasswordAction,
  onGoToLoginAfterResetAction,
  onRetrySessionAction,
}: PasswordResetFlowViewProps) {
  return (
    <PasswordResetLayout
      currentStep={stepNumber}
      showBack={state.step !== 'email' && state.step !== 'complete'}
      showProgress={state.step !== 'complete'}
      status={status}
      isAuthenticated={isAuthenticated}
      isSessionUnavailable={isSessionUnavailable}
      onBack={onBackAction}
      onRestart={onRestartAction}
      onRetrySession={onRetrySessionAction}
    >
      {state.step === 'email' && (
        <PasswordResetEmailStep
          email={state.email}
          isSending={state.isSendingCode}
          onEmailChange={onEmailChangeAction}
          onSendCode={onSendCodeAction}
          onGoToLogin={onGoToLoginAction}
        />
      )}
      {state.step === 'verification' && (
        <PasswordResetVerificationStep
          email={state.requestedEmail || state.email}
          verificationCode={state.verificationCode}
          countdown={countdown.countdown}
          isActive={countdown.isActive}
          isSending={state.isSendingCode}
          isVerifying={state.isVerifyingCode}
          formatTime={countdown.formatTime}
          onVerificationCodeChange={onVerificationCodeChangeAction}
          onResendCode={onSendCodeAction}
          onVerifyCode={onVerifyCodeAction}
          onBackToEmail={onRestartAction}
        />
      )}
      {state.step === 'newPassword' && (
        <PasswordResetNewPasswordStep
          email={state.requestedEmail || state.email}
          newPassword={state.newPassword}
          confirmPassword={state.confirmPassword}
          isResetting={state.isResettingPassword}
          onNewPasswordChange={onNewPasswordChangeAction}
          onConfirmPasswordChange={onConfirmPasswordChangeAction}
          onResetPassword={onResetPasswordAction}
        />
      )}
      {state.step === 'complete' && (
        <PasswordResetCompleteStep onGoToLogin={onGoToLoginAfterResetAction} />
      )}
    </PasswordResetLayout>
  );
}
