'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShellSkeleton } from '@/app/main/components/AppShellSkeleton';
import { SessionUnavailableRecovery } from '@/app/main/components/SessionUnavailableRecovery';
import { useAuthSession } from '@/auth/hooks';
import Main from '@/main/Main';

export default function MainRouteShell() {
  const router = useRouter();
  const session = useAuthSession();

  useEffect(() => {
    if (session.status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [router, session.status]);

  if (session.status === 'loading' || session.status === 'unauthenticated') {
    return <AppShellSkeleton />;
  }

  if (session.status === 'unavailable') {
    return <SessionUnavailableRecovery onRetryAction={session.retry} />;
  }

  return <Main />;
}
