'use client';

import { useEffect, useState } from 'react';
import { getRequestTiming } from '../model/request-time';

function nextLabelBoundaryMs(totalSeconds: number): number {
  const unit = totalSeconds >= 86_400 ? 3_600 : 60;
  const remainder = totalSeconds % unit;
  return Math.max(1_000, Math.min(totalSeconds, remainder + 1) * 1_000);
}

export function useMatchingRequestClock(input: {
  readonly serverNow: string;
  readonly expiresAt: string;
  readonly roomSelectionDate: string | null;
}) {
  const { serverNow, expiresAt, roomSelectionDate } = input;
  const key = `${serverNow}:${expiresAt}:${roomSelectionDate ?? 'none'}`;
  const [clock, setClock] = useState({ key, elapsedMs: 0 });
  const elapsedMs = clock.key === key ? clock.elapsedMs : 0;
  const timing = getRequestTiming({
    ...input,
    elapsedMs,
  });

  useEffect(() => {
    const baseline = performance.now();
    let timer: number | null = null;
    let active = true;

    const schedule = (nextElapsedMs: number) => {
      const nextTiming = getRequestTiming({
        serverNow,
        expiresAt,
        roomSelectionDate,
        elapsedMs: nextElapsedMs,
      });
      if (nextTiming.kind === 'expired') return;
      timer = window.setTimeout(() => {
        if (!active) return;
        const elapsed = performance.now() - baseline;
        setClock({ key, elapsedMs: elapsed });
        schedule(elapsed);
      }, nextLabelBoundaryMs(nextTiming.totalSeconds));
    };

    schedule(0);
    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [expiresAt, key, roomSelectionDate, serverNow]);

  return timing;
}
