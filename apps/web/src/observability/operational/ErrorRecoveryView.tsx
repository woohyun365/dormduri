'use client';

import { useEffect, useRef } from 'react';
import { IconAlertCircle, IconAlertTriangle, IconRefresh, IconReload } from '@tabler/icons-react';

export type ErrorRecoveryViewProps = {
  scope: 'route' | 'global';
  recovering?: boolean;
  onRecover: () => void;
};

const RECOVERY_COPY = {
  route: {
    title: '화면을 불러오지 못했어요',
    description: '잠시 후 다시 시도해 주세요. 입력한 내용이나 오류 정보는 화면에 표시하지 않아요.',
    actionLabel: '다시 시도',
    recoveringLabel: '다시 불러오는 중',
    liveMessage: '화면을 다시 불러오고 있어요.',
  },
  global: {
    title: '서비스를 불러오지 못했어요',
    description: '일시적인 문제일 수 있어요. 페이지를 새로고침해 주세요.',
    actionLabel: '새로고침',
    recoveringLabel: '새로고침',
    liveMessage: '',
  },
} as const;

export function ErrorRecoveryView({
  scope,
  recovering = false,
  onRecover,
}: ErrorRecoveryViewProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const copy = RECOVERY_COPY[scope];
  const isGlobal = scope === 'global';
  const titleId = `${scope}-error-title`;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const content = (
    <section
      aria-labelledby={titleId}
      className={
        isGlobal
          ? 'w-full max-w-md text-center'
          : 'w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm'
      }
      role="alert"
    >
      <span
        className={
          isGlobal
            ? 'mx-auto flex size-14 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200'
            : 'mx-auto flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-600'
        }
      >
        {isGlobal ? (
          <IconAlertTriangle aria-hidden="true" className="size-7" />
        ) : (
          <IconAlertCircle aria-hidden="true" className="size-6" />
        )}
      </span>
      <h1
        className={`${isGlobal ? 'mt-5' : 'mt-4'} text-xl font-semibold text-slate-950 outline-none`}
        id={titleId}
        ref={headingRef}
        tabIndex={-1}
      >
        {copy.title}
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{copy.description}</p>
      <button
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:cursor-wait disabled:bg-slate-400 sm:w-auto"
        disabled={recovering}
        onClick={onRecover}
        type="button"
      >
        {isGlobal ? (
          <IconReload aria-hidden="true" className="size-4" />
        ) : (
          <IconRefresh aria-hidden="true" className="size-4" />
        )}
        {recovering ? copy.recoveringLabel : copy.actionLabel}
      </button>
      {scope === 'route' ? (
        <span aria-live="polite" className="sr-only">
          {recovering ? copy.liveMessage : ''}
        </span>
      ) : null}
    </section>
  );

  if (isGlobal) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
        {content}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-5xl items-center justify-center px-4 py-10 sm:px-6">
      {content}
    </main>
  );
}
