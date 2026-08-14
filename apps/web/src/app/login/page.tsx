import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginPageClient, { LoginPageFallback } from '@/auth/flows/login/LoginPageClient';

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
