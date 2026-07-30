import { LoginFeedbackStrip } from './LoginFeedbackStrip';
import type { LoginUiErrorState } from '../model/login-form.types';

interface LoginStatusAlertProps {
  error: LoginUiErrorState | null;
  cooldownLabel?: string;
}

export function LoginStatusAlert({ error, cooldownLabel }: LoginStatusAlertProps) {
  if (!error) return null;

  const isCooldown = error.status === 'locked' || error.status === 'throttled';
  const isConnectivityError = error.status === 'network-error' || error.status === 'server-error';

  return (
    <LoginFeedbackStrip
      variant={isCooldown ? 'warning' : isConnectivityError ? 'connectivity' : 'error'}
      title={error.message}
      role="alert"
    >
      {isCooldown && cooldownLabel ? (
        <p
          className="mt-1 text-xs font-medium text-amber-700"
          role="timer"
          aria-live="off"
          aria-label={`로그인 제한 남은 시간 ${cooldownLabel}`}
        >
          남은 시간: <strong className="ml-1 font-bold">{cooldownLabel}</strong>
        </p>
      ) : null}
    </LoginFeedbackStrip>
  );
}
