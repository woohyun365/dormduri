'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSession } from './useAuthSession';

export function useRedirectIfAuthenticated() {
  const router = useRouter();
  const session = useAuthSession();

  useEffect(() => {
    if (session.status === 'authenticated') {
      router.replace('/main');
    }
  }, [router, session.status]);

  return {
    isReadyToRender: session.status === 'unauthenticated' || session.status === 'unavailable',
    sessionStatus: session.status,
    retrySession: session.retry,
  };
}
