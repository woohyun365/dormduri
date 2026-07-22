'use client';

import { useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';

export function MatchingTabError({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry?: () => Promise<void>;
}) {
  const [retrying, setRetrying] = useState(false);
  const handleRetry = async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <section
      role={onRetry ? 'alert' : 'status'}
      aria-live={onRetry ? 'assertive' : 'polite'}
      className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
      data-testid="matching-tab-error"
    >
      <div
        className={
          onRetry
            ? 'p-5 min-[361px]:p-6 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-8 md:p-7'
            : 'p-5 min-[361px]:p-6 md:p-7'
        }
      >
        <div className="flex gap-4 md:items-center">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600">
            <WifiOff className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500">연결 상태 안내</p>
            <h2 className="mt-1 text-lg font-bold text-(--knu-text-primary)">
              {onRetry ? '매칭 정보를 불러오지 못했어요' : '현재 매칭을 이용할 수 없어요'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-(--knu-text-secondary)">{message}</p>
          </div>
        </div>
        {onRetry ? (
          <div className="mt-5 flex items-center md:mt-0 md:w-40">
            <button
              type="button"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-(--knu-primary) px-4 text-sm font-semibold text-white transition-colors hover:bg-(--knu-primary-hover) disabled:cursor-wait disabled:opacity-60"
              onClick={() => void handleRetry()}
              disabled={retrying}
            >
              <RefreshCw className={`size-4 ${retrying ? 'animate-spin' : ''}`} aria-hidden />
              {retrying ? '다시 불러오는 중' : '다시 시도'}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
