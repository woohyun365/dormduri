'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShellSkeleton } from '@/components/AppShellSkeleton';
import { useAuthSession } from '@/auth/hooks';
import Main from '@/main/Main';

export default function MainRouteShell() {
  const router = useRouter();
  const { user: sessionUser, isLoading: isSessionLoading } = useAuthSession();

  useEffect(() => {
    if (!isSessionLoading && !sessionUser) {
      router.replace('/login');
    }
  }, [isSessionLoading, router, sessionUser]);

  if (isSessionLoading || !sessionUser) {
    return <AppShellSkeleton />;
  }

  return <Main />;
}
