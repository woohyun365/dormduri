'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { SESSION_ACTIVITY_EVENT, SESSION_CLOSED_EVENT } from '@/client/bff-client';
import { Notice } from '@/ui/Notice';

/** Idle limit of OA-R3; the API enforces it, this copy only restarts the on-screen countdown. */
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

// The idle and closed notices are the login page's notice for the same `ended` value without its last sentence, which
// the link stands for. The 8-hour notice names its own limit; the login page's `expired` notice names both limits.
const NOTICES = {
  idle: { text: '15분 동안 활동이 없어 접속이 끝났습니다.', ended: 'idle' },
  absolute: { text: '로그인한 지 8시간이 지나 접속이 끝났습니다.', ended: 'expired' },
  closed: {
    text: '이 접속은 끝났습니다. 다른 창에서 로그아웃했거나 역할·계정 상태가 바뀌었을 수 있습니다.',
    ended: 'closed',
  },
} as const;

/**
 * The console shell's one place for an ended session (README §4).
 *
 * Idle notice (OA-R3): the screen never asks the API whether the session still lives,
 * because every API request moves the last activity and a poll would keep an idle session open.
 * It counts down from the server's last answer instead, and starts over after a BFF call that
 * reached the API or a navigation (the next page reads the session on the server). Activity also
 * clears a notice shown too early. The absolute limit does not move.
 *
 * Closed notice: a BFF call that finds the session gone (`SESSION_CLOSED_EVENT`) shows it and stops
 * both countdowns, and later activity does not clear it. The page and what the operator typed stay.
 */
export function SessionEndNotice({
  idleRemainingMs,
  absoluteRemainingMs,
}: {
  readonly idleRemainingMs: number;
  readonly absoluteRemainingMs: number;
}) {
  const [ended, setEnded] = useState<keyof typeof NOTICES | null>(null);
  const closed = useRef(false);
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
      if (closed.current) return;
      const idleFirst = idleDeadline <= absoluteDeadline;
      const wait = Math.max(0, Math.min(idleDeadline, absoluteDeadline) - Date.now());
      timer = setTimeout(() => setEnded(idleFirst ? 'idle' : 'absolute'), wait);
    };
    const onActivity = () => {
      if (closed.current) return;
      idleDeadline = Date.now() + IDLE_TIMEOUT_MS;
      setEnded(null);
      schedule();
    };
    const onClosed = () => {
      closed.current = true;
      clearTimeout(timer);
      setEnded('closed');
    };
    schedule();
    window.addEventListener(SESSION_ACTIVITY_EVENT, onActivity);
    window.addEventListener(SESSION_CLOSED_EVENT, onClosed);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(SESSION_ACTIVITY_EVENT, onActivity);
      window.removeEventListener(SESSION_CLOSED_EVENT, onClosed);
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
  const notice = NOTICES[ended];
  // Every ended session reads as a warning (yellow); red stays for input errors (design guide ④).
  return (
    <Notice tone="warning" role="alert">
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {notice.text}
        <Link
          href={`/login?ended=${notice.ended}`}
          prefetch={false}
          className="font-semibold underline focus-ring"
        >
          다시 로그인
        </Link>
      </span>
    </Notice>
  );
}
