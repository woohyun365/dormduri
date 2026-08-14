'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BrowserSessionResolution } from '@repo/shared/auth/session';
import type { AuthenticatedSessionUser } from '@repo/shared/auth/response';
import { authApi } from '@/auth/api';

export const AUTH_SESSION_CHECK_TIMEOUT_MS = 3_000;

/**
 * 현재 auth session identity를 반환한다.
 *
 * `POST /api/auth/session/resolve` BFF → opaque cookie/session resolve 경로만 사용한다.
 * 반환값은 계정 identity(`AuthenticatedSessionUser`)로 제한하며, season profile/view model을 만들지 않는다.
 */
export function useAuthSession() {
  const [resolution, setResolution] = useState<BrowserSessionResolution | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setResolution(null);
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, AUTH_SESSION_CHECK_TIMEOUT_MS);

    async function loadSession() {
      try {
        const result = await authApi.resolveSession(abortController.signal);
        if (cancelled) return;
        setResolution(result);
      } catch {
        if (!cancelled) {
          setResolution({ status: 'unavailable', code: 'AUTH_SESSION_UNAVAILABLE' });
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [attempt]);

  const status = resolution?.status ?? 'loading';
  const user: AuthenticatedSessionUser | null =
    resolution?.status === 'authenticated' ? resolution.user : null;

  return {
    user,
    status,
    isLoading: status === 'loading',
    code: resolution?.status === 'unavailable' ? resolution.code : undefined,
    retry,
  };
}
