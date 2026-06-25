import type { ReactNode } from 'react';
import Link from 'next/link';
import { AuthHeader } from '@/auth/components';

interface SignupLayoutProps {
  children: ReactNode;
  showServiceNotice?: boolean;
  onLogoClick?: () => boolean;
}

export function SignupLayout({
  children,
  showServiceNotice = true,
  onLogoClick,
}: SignupLayoutProps) {
  return (
    <div className="min-h-svh bg-white">
      <AuthHeader onLogoClick={onLogoClick} />

      {showServiceNotice && (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-center">
          <p className="keep-all text-xs text-amber-800">
            본 서비스는 강원대학교 공식 서비스가 아닌 독립 운영 서비스입니다.{' '}
            <Link href="/terms" className="font-medium underline">
              자세히 보기
            </Link>
          </p>
        </div>
      )}

      <main className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-10">{children}</main>
    </div>
  );
}
