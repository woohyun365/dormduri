'use client';

import { useState } from 'react';
import type { ComponentProps } from 'react';
import { PasswordResetFlowView } from '@/auth/flows/password-reset/PasswordResetFlowView';
import { PASSWORD_RESET_COPY } from '@/auth/flows/password-reset/model/password-reset-copy';

type PasswordResetFlowViewProps = ComponentProps<typeof PasswordResetFlowView>;
type ActionFeedbackTrigger = 'send' | 'verify' | 'reset';

interface PasswordResetFlowStoryScenarioProps extends PasswordResetFlowViewProps {
  actionFeedbackTrigger?: ActionFeedbackTrigger;
}

export function PasswordResetFlowStoryScenario(props: PasswordResetFlowStoryScenarioProps) {
  return <ControlledPasswordResetFlowStory key={JSON.stringify(props.state)} {...props} />;
}

function ControlledPasswordResetFlowStory({
  actionFeedbackTrigger,
  ...props
}: PasswordResetFlowStoryScenarioProps) {
  const [state, setState] = useState(props.state);
  const [status, setStatus] = useState(actionFeedbackTrigger ? null : props.status);
  const [countdown, setCountdown] = useState(props.countdown);

  return (
    <PasswordResetFlowView
      {...props}
      state={state}
      status={status}
      countdown={countdown}
      onEmailChangeAction={(email) => {
        setState((current) =>
          current.step === 'email' ? { ...current, email, operation: 'idle' } : current,
        );
        props.onEmailChangeAction(email);
      }}
      onVerificationCodeChangeAction={(verificationCode) => {
        setState((current) =>
          current.step === 'verification'
            ? { ...current, verificationCode, operation: 'idle' }
            : current,
        );
        props.onVerificationCodeChangeAction(verificationCode);
      }}
      onNewPasswordChangeAction={(newPassword) => {
        setState((current) =>
          current.step === 'newPassword' ? { ...current, newPassword, operation: 'idle' } : current,
        );
        props.onNewPasswordChangeAction(newPassword);
      }}
      onConfirmPasswordChangeAction={(confirmPassword) => {
        setState((current) =>
          current.step === 'newPassword'
            ? { ...current, confirmPassword, operation: 'idle' }
            : current,
        );
        props.onConfirmPasswordChangeAction(confirmPassword);
      }}
      onSendCodeAction={() => {
        props.onSendCodeAction();
        if (actionFeedbackTrigger === 'send') {
          setStatus(props.status);
        }
      }}
      onVerifyCodeAction={async () => {
        const result = await props.onVerifyCodeAction();
        if (result.success && state.step === 'verification') {
          setState({
            step: 'verified',
            operation: 'idle',
            email: state.email,
            grantExpiresAt: Date.now() + 900_000,
          });
          setStatus(null);
        } else if (actionFeedbackTrigger === 'verify') {
          setStatus(props.status);
          if (props.status?.kind === 'attempts-exhausted') {
            setCountdown({
              countdown: 0,
              isActive: false,
            });
          }
        }
        return result;
      }}
      onContinueAfterVerificationAction={() => {
        props.onContinueAfterVerificationAction();
        setState((current) =>
          current.step === 'verified'
            ? {
                step: 'newPassword',
                operation: 'idle',
                email: current.email,
                newPassword: '',
                confirmPassword: '',
                grantExpiresAt: current.grantExpiresAt,
              }
            : current,
        );
      }}
      onResetPasswordAction={async () => {
        const result = await props.onResetPasswordAction();
        if (result.restartRequired) {
          setState({
            step: 'email',
            operation: 'idle',
            email: props.state.step === 'newPassword' ? props.state.email : '',
          });
          setStatus({
            variant: 'warning',
            title: PASSWORD_RESET_COPY.status.resetRestartTitle,
            message: PASSWORD_RESET_COPY.status.resetRestartMessage,
          });
        } else if (actionFeedbackTrigger === 'reset') {
          setStatus(props.status);
        }
        return result;
      }}
    />
  );
}
