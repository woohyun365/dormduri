import { AuthFeedbackStrip } from '@/auth/components/feedback/AuthFeedbackStrip';
import type { LoginRouteStatus } from '../model/login-route-status';

interface LoginRouteStatusAlertProps {
  status: LoginRouteStatus | null;
}

export function LoginRouteStatusAlert({ status }: LoginRouteStatusAlertProps) {
  if (!status) return null;

  return (
    <AuthFeedbackStrip
      variant="success"
      role="status"
      title={status.title}
      description={status.message}
      className="mb-5"
    />
  );
}
