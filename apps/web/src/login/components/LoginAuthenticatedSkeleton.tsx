import { AuthHeader } from '@/components/AuthHeader';

export function LoginAuthenticatedSkeleton() {
  return (
    <div className="min-h-screen bg-(--knu-background-alt)">
      <AuthHeader showBack={false} containerClassName="mx-auto w-full max-w-5xl px-5 lg:px-8" />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center px-5 py-12">
        <div
          role="status"
          aria-live="polite"
          className="w-full rounded-2xl border-2 border-(--knu-border) bg-white p-6 text-center shadow-sm"
        >
          <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-full bg-(--knu-primary-light)" />
          <p className="text-base font-semibold text-(--knu-text-primary)">
            로그인 상태를 확인하고 있어요
          </p>
          <p className="mt-2 text-sm text-(--knu-text-secondary)">
            이미 로그인되어 있으면 홈으로 이동합니다.
          </p>
        </div>
      </main>
    </div>
  );
}
