import { useAuthSession } from '@/auth/hooks';

export function usePasswordResetSessionNotice() {
  const session = useAuthSession();
  return {
    isAuthenticated: session.status === 'authenticated',
    isSessionUnavailable: session.status === 'unavailable',
    retrySession: session.retry,
  };
}
