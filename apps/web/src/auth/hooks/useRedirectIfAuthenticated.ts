'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSession } from './useAuthSession';

export function useRedirectIfAuthenticated() {
  const router = useRouter();
  const { user, isLoading } = useAuthSession();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/main');
    }
  }, [isLoading, user, router]);

  return { isReadyToRender: !isLoading && !user };
}
