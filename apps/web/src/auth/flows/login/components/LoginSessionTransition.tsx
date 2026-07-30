import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { AuthHeader, AuthServiceNotice } from '@/auth/components';

export type LoginSessionTransitionState = 'checking' | 'redirecting';

interface LoginSessionTransitionProps {
  state: LoginSessionTransitionState;
}

const TRANSITION_COPY = {
  checking: {
    title: '로그인 상태를 확인하고 있어요',
    description: '잠시만 기다려 주세요.',
  },
  redirecting: {
    title: '로그인되어 있어요',
    description: '메인으로 이동하고 있어요.',
  },
} as const;

export function LoginSessionTransition({ state }: LoginSessionTransitionProps) {
  const copy = TRANSITION_COPY[state];
  const redirecting = state === 'redirecting';

  return (
    <div className="flex min-h-svh flex-col bg-(--knu-background-alt)">
      <AuthHeader containerClassName="mx-auto w-full max-w-5xl px-5 lg:px-8" />

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div
          role="status"
          aria-live="polite"
          data-state={state}
          className="w-full max-w-sm text-center motion-reduce:[&_*]:animate-none"
        >
          <span
            className={`mx-auto flex size-14 items-center justify-center rounded-full ${
              redirecting ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
            }`}
          >
            {redirecting ? (
              <CheckCircle2 className="size-7" aria-hidden="true" />
            ) : (
              <LoaderCircle className="size-7 animate-spin" aria-hidden="true" />
            )}
          </span>

          <h1 className="mt-5 text-xl font-bold text-(--knu-text-primary)">{copy.title}</h1>
          <p className="mt-2 text-sm text-(--knu-text-secondary)">{copy.description}</p>

          {redirecting ? (
            <span
              className="mx-auto mt-6 block h-1 w-28 overflow-hidden rounded-full bg-slate-200"
              aria-hidden="true"
            >
              <span className="block h-full w-full animate-pulse rounded-full bg-(--knu-primary)" />
            </span>
          ) : null}
        </div>
      </main>

      <footer className="px-5 pb-7 text-center">
        <AuthServiceNotice showDetailsLink={false} />
      </footer>
    </div>
  );
}
