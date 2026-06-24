import { useEffect, useState } from 'react';
import { authApi } from '@/api/auth';

export function usePasswordResetSessionNotice() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const session = await authApi.getSession();
        if (!cancelled && session.authenticated) {
          setIsAuthenticated(true);
        }
      } catch {
        // Password reset remains available when optional session check fails.
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  return { isAuthenticated };
}
