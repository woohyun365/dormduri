'use client';

import { useEffect, useRef } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface SessionUnavailableRecoveryProps {
  onRetryAction: () => void;
}

export function SessionUnavailableRecovery({ onRetryAction }: SessionUnavailableRecoveryProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-(--knu-background) px-5 py-10">
      <section
        role="alert"
        aria-labelledby="session-recovery-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8"
      >
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1
          ref={titleRef}
          id="session-recovery-title"
          tabIndex={-1}
          className="mt-4 text-lg font-bold text-slate-900 sm:text-xl"
        >
          로그인 상태를 확인하지 못했어요
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          연결이 안정되면 다시 확인해 주세요. 로그인 정보는 그대로 유지돼요.
        </p>
        <Button
          variant="outline"
          fullWidth
          className="mt-6"
          onClick={onRetryAction}
          aria-label="로그인 상태 다시 확인"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          다시 확인
        </Button>
      </section>
    </main>
  );
}
