'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShellSkeleton } from '@/components/AppShellSkeleton';
import { useCurrentUser } from '@/auth/hooks';
import Main from '@/main/Main';

export default function MainRouteShell() {
  const router = useRouter();
  const { user, isLoading } = useCurrentUser();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, router, user]);

  if (isLoading || !user) {
    return <AppShellSkeleton />;
  }

  return <Main initialUser={user} />;
}
