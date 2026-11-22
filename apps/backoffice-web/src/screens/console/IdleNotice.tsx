'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { SESSION_ACTIVITY_EVENT } from '@/client/bff-client';

export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Idle notice (OA-R3, plan §15): the screen never asks the API whether the session still lives,
 * because every API request moves the last activity and a poll would keep an idle session open.
 * It counts down from the server's last answer instead, and starts over after a BFF call or a
 * navigation (the next page reads the session on the server). The absolute limit does not move.
 */
export function IdleNotice({
  idleRemainingMs,
  absoluteRemainingMs,
}: {
  readonly idleRemainingMs: number;
  readonly absoluteRemainingMs: number;
}) {
  const [ended, setEnded] = useState<'idle' | 'absolute' | null>(null);
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const firstNavigation = useRef(true);

  useEffect(() => {
    const start = Date.now();
    const absoluteDeadline = start + absoluteRemainingMs;
    let idleDeadline = start + idleRemainingMs;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      const idleFirst = idleDeadline <= absoluteDeadline;
      const wait = Math.max(0, Math.min(idleDeadline, absoluteDeadline) - Date.now());
      timer = setTimeout(() => setEnded(idleFirst ? 'idle' : 'absolute'), wait);
    };
    const onActivity = () => {
      idleDeadline = Date.now() + IDLE_TIMEOUT_MS;
      schedule();
    };
    schedule();
    window.addEventListener(SESSION_ACTIVITY_EVENT, onActivity);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(SESSION_ACTIVITY_EVENT, onActivity);
    };
  }, [idleRemainingMs, absoluteRemainingMs]);

  useEffect(() => {
    if (firstNavigation.current) {
      firstNavigation.current = false;
      return;
    }
    window.dispatchEvent(new Event(SESSION_ACTIVITY_EVENT));
  }, [pathname, search]);

  if (!ended) {
    return null;
  }
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <span>
        {ended === 'idle'
          ? '15분 동안 활동이 없어 접속이 끝났습니다.'
          : '로그인한 지 8시간이 지나 접속이 끝났습니다.'}
      </span>
      <Link
        href={`/login?ended=${ended === 'idle' ? 'idle' : 'expired'}`}
        prefetch={false}
        className="font-medium underline"
      >
        다시 로그인
      </Link>
    </div>
  );
}
