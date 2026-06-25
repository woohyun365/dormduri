'use client';

import { useEffect, useState } from 'react';
import type { AuthenticatedSessionUser } from '@repo/shared/auth/response';
import { authApi } from '@/auth/api';

export const AUTH_SESSION_CHECK_TIMEOUT_MS = 3_000;

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
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function createSessionCheckTimeout() {
      return new Promise<Awaited<ReturnType<typeof authApi.getSession>>>((resolve) => {
        timeoutId = setTimeout(() => {
          resolve({ authenticated: false });
        }, AUTH_SESSION_CHECK_TIMEOUT_MS);
      });
    }

    async function loadSession() {
      try {
        const result = await Promise.race([authApi.getSession(), createSessionCheckTimeout()]);
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (cancelled) return;

        if (result.authenticated && result.user) {
          setUser(result.user);
          setIsLoading(false);
          return;
        }
      } catch {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
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
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return { user, isLoading };
}
