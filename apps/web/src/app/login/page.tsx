import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginPageClient from '@/auth/flows/login/LoginPageClient';

export const metadata: Metadata = {
  title: '로그인',
  description: '강원대학교 기숙사 룸메이트 매칭 서비스 로그인',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageClient />
    </Suspense>
  );
}

function LoginPageFallback() {
  return (
    <main
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-(--knu-background-alt) px-5"
    >
      <p className="rounded-2xl border-2 border-(--knu-border) bg-white px-6 py-5 text-center text-sm font-semibold text-(--knu-text-primary) shadow-sm">
        로그인 화면을 준비하고 있어요
      </p>
    </main>
  );
}
