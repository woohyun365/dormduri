import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AuthHeader } from '@/components/AuthHeader';

interface LoginLayoutProps {
  children: ReactNode;
  footer?: ReactNode;
}

export function LoginLayout({ children, footer }: LoginLayoutProps) {
  return (
    <div className="min-h-screen bg-(--knu-background-alt)">
      <AuthHeader showBack={false} containerClassName="mx-auto w-full max-w-5xl px-5 lg:px-8" />

      <main className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-8 px-5 py-10 md:py-16 lg:grid-cols-[minmax(0,1fr)_28rem] lg:px-8">
        <aside
          aria-labelledby="login-help-title"
          className="hidden rounded-3xl border-2 border-(--knu-border) bg-white p-8 shadow-sm lg:block"
        >
          <p className="mb-3 text-sm font-semibold text-(--knu-primary)">KNU 룸메 로그인</p>
          <h2
            id="login-help-title"
            className="mb-4 text-3xl font-bold leading-tight text-(--knu-text-primary)"
          >
            강원대 이메일로 안전하게 이어서 사용하세요
          </h2>
          <p className="keep-all mb-8 text-base leading-7 text-(--knu-text-secondary)">
            본 서비스는 강원대학교 공식 서비스가 아닌 독립 운영 서비스입니다. 학교 이메일로 본인
            확인을 마친 계정만 로그인할 수 있습니다.
          </p>

          <dl className="space-y-5">
            <div className="rounded-2xl bg-(--knu-background-alt) p-5">
              <dt className="font-semibold text-(--knu-text-primary)">학교 이메일 로그인</dt>
              <dd className="mt-1 text-sm leading-6 text-(--knu-text-secondary)">
                가입 때 인증한 강원대학교 이메일과 비밀번호를 사용합니다.
              </dd>
            </div>
            <div className="rounded-2xl bg-(--knu-background-alt) p-5">
              <dt className="font-semibold text-(--knu-text-primary)">로그인 유지</dt>
              <dd className="mt-1 text-sm leading-6 text-(--knu-text-secondary)">
                개인 기기에서만 선택해주세요. 선택 시 최대 7일 동안 다시 로그인하지 않아도 됩니다.
              </dd>
            </div>
            <div className="rounded-2xl bg-(--knu-background-alt) p-5">
              <dt className="font-semibold text-(--knu-text-primary)">비밀번호 재설정</dt>
              <dd className="mt-1 text-sm leading-6 text-(--knu-text-secondary)">
                비밀번호가 기억나지 않으면 로그인 폼의 비밀번호 찾기에서 재설정할 수 있습니다.
              </dd>
            </div>
          </dl>
        </aside>

        <section aria-labelledby="login-title" className="mx-auto w-full max-w-md lg:mx-0">
          <div className="mb-8 text-center lg:mb-10">
            <Image
              src="/knu_logo.svg"
              alt="KNU 로고"
              width={80}
              height={80}
              className="mx-auto mb-6 rounded-full shadow-lg"
            />
            <h1
              id="login-title"
              className="mb-3 text-3xl font-bold text-(--knu-text-primary) md:text-4xl"
            >
              로그인
            </h1>
            <p className="text-(--knu-text-secondary)">KNU 룸메에 오신 것을 환영합니다</p>
            <p className="keep-all mt-2 text-xs text-(--knu-text-tertiary)">
              본 서비스는 강원대학교 공식 서비스가 아닌 독립 운영 서비스입니다.{' '}
              <Link href="/terms" className="underline">
                자세히 보기
              </Link>
            </p>
          </div>

          {children}
          {footer}
        </section>
      </main>
    </div>
  );
}
