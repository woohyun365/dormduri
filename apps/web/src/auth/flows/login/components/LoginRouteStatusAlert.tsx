import { LoginFeedbackStrip } from './LoginFeedbackStrip';
import type { LoginRouteStatus } from '../model/login-route-status';

interface LoginRouteStatusAlertProps {
  status: LoginRouteStatus | null;
}

export function LoginRouteStatusAlert({ status }: LoginRouteStatusAlertProps) {
  if (!status) return null;

  return (
    <LoginFeedbackStrip
      variant="success"
      role="status"
      title={status.title}
      description={status.message}
    />
  );
}
