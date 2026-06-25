import { AlertCircle, Timer } from 'lucide-react';
import type { LoginUiErrorState } from '../model/login-form.types';

interface LoginStatusAlertProps {
  error: LoginUiErrorState | null;
  cooldownLabel?: string;
}

export function LoginStatusAlert({ error, cooldownLabel }: LoginStatusAlertProps) {
  if (!error) return null;

  const isCooldown = error.status === 'locked' || error.status === 'throttled';
  const Icon = isCooldown ? Timer : AlertCircle;
  const containerClassName = isCooldown
    ? 'mb-6 flex items-start gap-3 rounded-xl border-2 border-amber-200 bg-amber-50 p-4'
    : 'mb-6 flex items-start gap-3 rounded-xl border-2 border-red-200 bg-red-50 p-4';
  const iconClassName = isCooldown
    ? 'mt-0.5 h-5 w-5 shrink-0 text-amber-600'
    : 'mt-0.5 h-5 w-5 shrink-0 text-red-600';
  const messageClassName = isCooldown
    ? 'text-sm font-medium text-amber-900'
    : 'text-sm font-medium text-red-900';

  return (
    <div className={containerClassName} role="alert" aria-live="polite">
      <Icon className={iconClassName} />
      <div>
        <p className={messageClassName}>{error.message}</p>
        {isCooldown && cooldownLabel ? (
          <p className="mt-1 text-sm text-amber-700">
            남은 시간: <strong>{cooldownLabel}</strong>
          </p>
        ) : null}
      </div>
    </div>
  );
}
