'use client';

import { useState, useEffect } from 'react';
import type { UserProfile } from '@/types/profile';

/**
 * 개발 환경: localStorage 기반 mock 유저 로딩
 * 프로덕션: TODO — fetch('/api/user/me') 로 교체
 *
 * 기존 useSearchParams() 방식에서 localStorage로 전환.
 * 사유: useSearchParams()가 Next.js 빌드 시 prerender 에러를 유발.
 * localStorage는 클라이언트 전용이라 prerender에 안전하다.
 *
 * DevPanel에서 localStorage 값을 변경하면 페이지 새로고침 후 반영.
 */
export function useCurrentUser() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      if (process.env.NODE_ENV === 'development') {
        const { mockDb } = await import('@/__fixtures__/mock-db');
        await mockDb.initFromFixtures();

        // 로그인한 유저가 있으면 우선 사용
        const loggedIn = mockDb.getCurrentUser();
        if (loggedIn) {
          setUser({
            nickname: loggedIn.nickname,
            gender: loggedIn.gender,
            dormitoryId: loggedIn.dormitoryId,
            lifestyle: loggedIn.lifestyle,
            intro: loggedIn.intro,
            messageToRoommate: null,
            additional: { college: null, grade: null, mbti: null, temperatureSensitivity: null },
          });
        } else {
          // 직접 /main 접속: localStorage에서 성별 읽기
          const { getMockUser } = await import('@/__fixtures__/mock-users');
          const gender = localStorage.getItem('dev-gender');
          setUser(getMockUser(gender));
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
