'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { UserProfile } from '@/types/profile';

export function useCurrentUser() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      if (process.env.NODE_ENV === 'development') {
        const { getMockUser } = await import('@/__fixtures__/mock-users');
        setUser(getMockUser(searchParams.get('gender')));
      } else {
        // TODO: BE 연동 시 fetch('/api/user/me') 로 교체
        setUser(null);
      }
      setIsLoading(false);
    }
    loadUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { user, setUser, isLoading };
}
