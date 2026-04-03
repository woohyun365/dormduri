'use client';

import { useState, useEffect } from 'react';
import { authApi } from '@/api/auth';
import type { UserProfile } from '@/types/profile';
import { toUserProfile } from '@/auth/to-user-profile';

/**
 * 현재 로그인 유저를 반환하는 훅
 *
 * `/api/auth/session` BFF → NestJS JWT 검증 경로만 사용한다.
 * 미로그인 또는 세션 무효 시 user는 null을 반환한다.
 */
export function useCurrentUser() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const result = await authApi.getSession();
        if (result.authenticated && result.user) {
          setUser(toUserProfile(result.user));
          setIsLoading(false);
          return;
        }
      } catch {
        // ignore and fall through to unauthenticated state
      }

      setUser(null);
      setIsLoading(false);
    }
    void loadUser();
  }, []);

  return { user, setUser, isLoading };
}
