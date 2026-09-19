'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppShellSkeleton } from '@/app/main/components/AppShellSkeleton';
import { SessionUnavailableRecovery } from '@/app/main/components/SessionUnavailableRecovery';
import { useAuthSession } from '@/auth/hooks';
import { MainRuntime } from '@/main/runtime/MainRuntime';

export default function MainRouteShell({ children }: { children: ReactNode }) {
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

  if (!session.user) return <AppShellSkeleton />;

  return (
    <MainRuntime key={session.user.id} viewerId={session.user.id}>
      {children}
    </MainRuntime>
  );
}
