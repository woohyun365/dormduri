'use client';

import { useEffect, useState } from 'react';
import type { AuthenticatedSessionUser } from '@repo/shared/auth/response';
import { authApi } from '@/auth/api';

/**
 * 현재 auth session identity를 반환한다.
 *
 * `/api/auth/session` BFF → opaque cookie/session resolve 경로만 사용한다.
 * 반환값은 계정 identity(`AuthenticatedSessionUser`)로 제한하며, season profile/view model을 만들지 않는다.
 */
export function useAuthSession() {
  const [user, setUser] = useState<AuthenticatedSessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const result = await authApi.getSession();
        if (cancelled) return;

        if (result.authenticated && result.user) {
          setUser(result.user);
          setIsLoading(false);
          return;
        }
      } catch {
        // ignore and fall through to unauthenticated state
      }

      if (!cancelled) {
        setUser(null);
        setIsLoading(false);
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  return { user, isLoading };
}
