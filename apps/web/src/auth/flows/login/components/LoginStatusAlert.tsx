import { AuthActionFeedback } from '@/auth/components/feedback/AuthActionFeedback';
import { AuthRemainingTime } from '@/auth/components/feedback/AuthRemainingTime';
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
    <AuthActionFeedback
      variant={isCooldown ? 'warning' : isConnectivityError ? 'connectivity' : 'error'}
      title={error.message}
      role="alert"
      className="mb-5"
    >
      {isCooldown && cooldownLabel ? (
        <AuthRemainingTime value={cooldownLabel} contextLabel="로그인 제한" />
      ) : null}
    </AuthActionFeedback>
  );
}
