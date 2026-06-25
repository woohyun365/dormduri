import type { PasswordResetStatus } from '../model/password-reset-flow.types';

interface PasswordResetStatusAlertProps {
  status: PasswordResetStatus | null;
  onRestart?: () => void;
}

const statusStyles = {
  info: 'border-blue-200 bg-blue-50 text-blue-950',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  error: 'border-red-200 bg-red-50 text-red-950',
} as const;

const statusDotStyles = {
  info: 'bg-blue-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
} as const;

export function PasswordResetStatusAlert({ status, onRestart }: PasswordResetStatusAlertProps) {
  if (!status) return null;

  return (
    <div
      role={status.variant === 'error' || status.variant === 'warning' ? 'alert' : 'status'}
      aria-live={
        status.variant === 'error' || status.variant === 'warning' ? 'assertive' : 'polite'
      }
      className={`rounded-2xl border-2 p-4 ${statusStyles[status.variant]}`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${statusDotStyles[status.variant]}`}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-bold">{status.title}</p>
          <p className="keep-all text-sm leading-6">{status.message}</p>
          {status.action === 'restart' && onRestart && (
            <button
              type="button"
              onClick={onRestart}
              className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              이메일부터 다시 진행하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
