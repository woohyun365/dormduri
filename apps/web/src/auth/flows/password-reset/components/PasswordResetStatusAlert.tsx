import { AuthActionFeedback } from '@/auth/components/feedback/AuthActionFeedback';
import {
  AuthRemainingTime,
  formatAuthRemainingTime,
} from '@/auth/components/feedback/AuthRemainingTime';
import { type AuthFeedbackVariant } from '@/auth/components/feedback/AuthFeedbackStrip';
import type { PasswordResetStatus } from '../model/password-reset-flow.types';
import { PASSWORD_RESET_COPY } from '../model/password-reset-copy';

interface PasswordResetStatusAlertProps {
  status: PasswordResetStatus | null;
}

export function PasswordResetStatusAlert({ status }: PasswordResetStatusAlertProps) {
  if (!status) return null;

  const isNetwork = status.kind === 'network';
  const isRateLimited = status.isRetryAfter === true;
  const variant: AuthFeedbackVariant = isNetwork
    ? 'connectivity'
    : isRateLimited
      ? 'warning'
      : status.variant;

  return (
    <AuthActionFeedback
      testId="password-reset-feedback-region"
      variant={variant}
      title={status.title}
      description={status.message}
      role={status.variant === 'error' || status.variant === 'warning' ? 'alert' : 'status'}
    >
      {isRateLimited && status.countdownSeconds !== undefined ? (
        <AuthRemainingTime
          value={formatAuthRemainingTime(status.countdownSeconds)}
          contextLabel={PASSWORD_RESET_COPY.retryAfterContext}
        />
      ) : null}
    </AuthActionFeedback>
  );
}
