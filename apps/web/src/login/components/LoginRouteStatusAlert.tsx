import { CheckCircle } from 'lucide-react';
import type { LoginRouteStatus } from '../model/login-route-status';

interface LoginRouteStatusAlertProps {
  status: LoginRouteStatus | null;
}

export function LoginRouteStatusAlert({ status }: LoginRouteStatusAlertProps) {
  if (!status) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex items-start gap-3 rounded-xl border-2 border-green-200 bg-green-50 p-4"
    >
      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-green-900">{status.title}</p>
        <p className="mt-1 text-sm leading-6 text-green-800">{status.message}</p>
      </div>
    </div>
  );
}
