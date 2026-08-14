import { AuthSessionUnavailableStatus } from '@/auth/components';
import { PasswordResetEmailStep } from './components/PasswordResetEmailStep';
import { PasswordResetLayout } from './components/PasswordResetLayout';
import { PasswordResetVerificationStep } from './components/PasswordResetVerificationStep';
import { PasswordResetNewPasswordStep } from './components/PasswordResetNewPasswordStep';
import { PasswordResetCompleteStep } from './components/PasswordResetCompleteStep';
import { PasswordResetStatusAlert } from './components/PasswordResetStatusAlert';
import { PASSWORD_RESET_COPY } from './model/password-reset-copy';
import type {
  PasswordResetActionResult,
  PasswordResetFlowState,
  PasswordResetStatus,
} from './model/password-reset-flow.types';

interface PasswordResetFlowViewProps {
  state: PasswordResetFlowState;
  countdown: {
    countdown: number;
    isActive: boolean;
  };
  status: PasswordResetStatus | null;
  isSessionUnavailable: boolean;
  onBackAction: () => void;
  onRestartAction: () => void;
  onEmailChangeAction: (email: string) => void;
  onSendCodeAction: () => void;
  onGoToLoginAction: () => void;
  onVerificationCodeChangeAction: (verificationCode: string) => void;
  onVerifyCodeAction: () => Promise<PasswordResetActionResult>;
  onContinueAfterVerificationAction: () => void;
  onNewPasswordChangeAction: (newPassword: string) => void;
  onConfirmPasswordChangeAction: (confirmPassword: string) => void;
  onResetPasswordAction: () => Promise<PasswordResetActionResult>;
  onGoToLoginAfterResetAction: () => void;
  onRetrySessionAction: () => void;
}

export function PasswordResetFlowView({
  state,
  countdown,
  status,
  isSessionUnavailable,
  onBackAction,
  onRestartAction,
  onEmailChangeAction,
  onSendCodeAction,
  onGoToLoginAction,
  onVerificationCodeChangeAction,
  onVerifyCodeAction,
  onContinueAfterVerificationAction,
  onNewPasswordChangeAction,
  onConfirmPasswordChangeAction,
  onResetPasswordAction,
  onGoToLoginAfterResetAction,
  onRetrySessionAction,
}: PasswordResetFlowViewProps) {
  const currentStep = state.step === 'newPassword' || state.step === 'complete' ? 2 : 1;
  const isRateLimited = status?.isRetryAfter === true;
  const isAttemptsExhausted = status?.kind === 'attempts-exhausted';
  const actionFeedback = status ? <PasswordResetStatusAlert status={status} /> : undefined;
  const sessionStatus = isSessionUnavailable ? (
    <AuthSessionUnavailableStatus
      title={PASSWORD_RESET_COPY.session.unavailable.title}
      description={PASSWORD_RESET_COPY.session.unavailable.description}
      retryLabel={PASSWORD_RESET_COPY.session.unavailable.retry}
      onRetryAction={onRetrySessionAction}
      testId="password-reset-session-status"
    />
  ) : undefined;

  return (
    <PasswordResetLayout
      currentStep={currentStep}
      showBack={state.step === 'verification'}
      showProgress={state.step !== 'complete'}
      onBack={onBackAction}
    >
      {state.step === 'email' && (
        <PasswordResetEmailStep
          email={state.email}
          isVerified={false}
          isSending={state.operation === 'submitting'}
          isRateLimited={isRateLimited}
          sessionStatus={sessionStatus}
          actionFeedback={actionFeedback}
          onEmailChange={onEmailChangeAction}
          onSendCode={onSendCodeAction}
          onGoToLogin={onGoToLoginAction}
          onContinue={onContinueAfterVerificationAction}
        />
      )}
      {state.step === 'verified' && (
        <PasswordResetEmailStep
          email={state.email}
          isVerified
          isSending={false}
          isRateLimited={false}
          sessionStatus={sessionStatus}
          onEmailChange={onEmailChangeAction}
          onSendCode={onSendCodeAction}
          onGoToLogin={onGoToLoginAction}
          onContinue={onContinueAfterVerificationAction}
        />
      )}
      {state.step === 'verification' && (
        <PasswordResetVerificationStep
          email={state.email}
          verificationCode={state.verificationCode}
          countdown={countdown.countdown}
          isActive={countdown.isActive}
          isSending={state.operation === 'resending'}
          isVerifying={state.operation === 'verifying'}
          isRateLimited={isRateLimited}
          isAttemptsExhausted={isAttemptsExhausted}
          sessionStatus={sessionStatus}
          actionFeedback={actionFeedback}
          onVerificationCodeChange={onVerificationCodeChangeAction}
          onResendCode={onSendCodeAction}
          onVerifyCode={onVerifyCodeAction}
          onBackToEmail={onRestartAction}
        />
      )}
      {state.step === 'newPassword' && (
        <PasswordResetNewPasswordStep
          email={state.email}
          newPassword={state.newPassword}
          confirmPassword={state.confirmPassword}
          isResetting={state.operation === 'submitting'}
          isRateLimited={isRateLimited}
          sessionStatus={sessionStatus}
          actionFeedback={actionFeedback}
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
