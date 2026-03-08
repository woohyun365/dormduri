'use client';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import Landing from '@/landing/Landing';
import Main from '@/main/Main';

/**
 * `/` 게이트웨이: 로그인 상태에 따라 Main 또는 Landing을 렌더링한다.
 *
 * - 로그인 O → <Main />
 * - 로그인 X → <Landing />
 *
 * TODO: 백엔드 연동 시 Next.js middleware 기반 서버사이드 인증으로 전환
 * - middleware.ts에서 auth-token 쿠키 검증
 * - 클라이언트 가드는 fallback으로 유지하거나 제거
 */
export default function GatewayPage() {
  const { user, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--knu-background-alt)] flex items-center justify-center">
        <p className="text-[var(--knu-text-tertiary)]">로딩 중...</p>
      </div>
    );
  }

  if (!user) {
    return <Landing />;
  }

  return <Main initialUser={user} />;
}
