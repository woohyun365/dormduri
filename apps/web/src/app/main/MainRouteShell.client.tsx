'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShellSkeleton } from '@/components/AppShellSkeleton';
import { useAuthSession } from '@/auth/hooks';
import Main from '@/main/Main';
import { useMainBootstrap } from '@/main/hooks/useMainBootstrap';

function MainBootstrapErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--knu-background-alt)] px-5 py-12">
      <section
        role="alert"
        aria-labelledby="main-bootstrap-error-title"
        className="w-full max-w-md rounded-3xl border border-[var(--knu-border)] bg-white p-6 text-center shadow-sm"
      >
        <p className="text-sm font-semibold text-[var(--knu-primary)]">
          프로필 정보를 확인하지 못했어요
        </p>
        <h1
          id="main-bootstrap-error-title"
          className="mt-2 text-xl font-bold text-[var(--knu-text-primary)]"
        >
          잠시 후 다시 시도해주세요
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--knu-text-secondary)]">
          로그인은 확인됐지만 메인 화면에 필요한 시즌 프로필 정보를 불러오지 못했습니다. 문제가
          계속되면 다시 로그인하거나 운영 문의를 이용해주세요.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 w-full rounded-2xl bg-[var(--knu-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--knu-primary-dark)]"
        >
          다시 불러오기
        </button>
      </section>
    </main>
  );
}

export default function MainRouteShell() {
  const router = useRouter();
  const { user: sessionUser, isLoading: isSessionLoading } = useAuthSession();
  const mainBootstrap = useMainBootstrap({
    enabled: Boolean(sessionUser),
    sessionUserId: sessionUser?.id ?? null,
  });

  useEffect(() => {
    if (!isSessionLoading && !sessionUser) {
      router.replace('/login');
    }
  }, [isSessionLoading, router, sessionUser]);

  if (isSessionLoading || !sessionUser || mainBootstrap.isLoading) {
    return <AppShellSkeleton />;
  }

  if (!mainBootstrap.profile) {
    return <MainBootstrapErrorState onRetry={mainBootstrap.retry} />;
  }

  return <Main initialUser={mainBootstrap.profile} />;
}
