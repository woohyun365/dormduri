'use client';

import { useState, useEffect } from 'react';
import { authApi } from '@/api/auth';
import type { UserProfile } from '@/types/profile';

/**
 * 현재 로그인 유저를 반환하는 훅
 *
 * 현재는 `/api/auth/session` BFF → NestJS JWT 검증 경로를 우선 사용한다.
 * 개발 중 API 서버가 내려가 있는 경우에만 localStorage mock currentUser로 폴백한다.
 *
 * 미로그인 시 user는 null을 반환한다.
 * 호출측에서 null 여부로 인증 상태를 판단하여 리다이렉트 처리.
 */
export function useCurrentUser() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const result = await authApi.getSession();
        if (result.authenticated && result.user) {
          setUser({
            id: result.user.id,
            nickname: result.user.nickname,
            gender: result.user.gender,
            campus: result.user.campus,
            dormitoryId: result.user.dormitoryId,
            lifestyle: result.user.lifestyle,
            intro: result.user.intro,
            messageToRoommate: null,
            additional: { college: null, grade: null, mbti: null, birthYear: null },
          });
          setIsLoading(false);
          return;
        }
      } catch {
        if (process.env.NODE_ENV === 'development') {
          const { mockDb } = await import('@/__fixtures__/mock-db');
          const loggedIn = mockDb.getCurrentUser();
          if (loggedIn) {
            setUser({
              id: loggedIn.id,
              nickname: loggedIn.nickname,
              gender: loggedIn.gender,
              campus: loggedIn.campus,
              dormitoryId: loggedIn.dormitoryId,
              lifestyle: loggedIn.lifestyle,
              intro: loggedIn.intro,
              messageToRoommate: null,
              additional: { college: null, grade: null, mbti: null, birthYear: null },
            });
            setIsLoading(false);
            return;
          }
        }
      }

      setUser(null);
      setIsLoading(false);
    }
    loadUser();
  }, []);

  return { user, setUser, isLoading };
}
