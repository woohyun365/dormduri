'use client';

import { useState, useEffect } from 'react';
import type { UserProfile } from '@/types/profile';

/**
 * 현재 로그인 유저를 반환하는 훅
 *
 * 개발 환경: mockDb(localStorage 기반)에서 로드
 * 프로덕션: TODO — fetch('/api/user/me') 로 교체
 *
 * 미로그인 시 user는 null을 반환한다.
 * 호출측에서 null 여부로 인증 상태를 판단하여 리다이렉트 처리.
 */
export function useCurrentUser() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
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
            additional: { college: null, grade: null, mbti: null, temperatureSensitivity: null },
          });
        } else {
          setUser(null);
        }
      } else {
        // TODO: BE 연동 시 fetch('/api/user/me') 로 교체
        setUser(null);
      }
      setIsLoading(false);
    }
    loadUser();
  }, []);

  return { user, setUser, isLoading };
}
