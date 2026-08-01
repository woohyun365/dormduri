import { WifiOff } from 'lucide-react';

interface AuthSessionUnavailableStatusProps {
  title: string;
  description: string;
  onRetryAction: () => void;
  retryLabel?: string;
  className?: string;
  testId?: string;
}

export function AuthSessionUnavailableStatus({
  title,
  description,
  onRetryAction,
  retryLabel = '다시 확인',
  className = '',
  testId,
}: AuthSessionUnavailableStatusProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={testId}
      className={`flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700 ${className}`}
    >
      <WifiOff className="mt-0.5 size-4.5 shrink-0 text-slate-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-5 text-slate-800">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-600">{description}</p>
        <button
          type="button"
          onClick={onRetryAction}
          className="mt-1 rounded-md px-1 py-0.5 text-xs font-semibold text-slate-700 underline-offset-4 transition-colors hover:bg-slate-200/70 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
        >
          {retryLabel}
        </button>
      </div>
    </div>
  );
}
