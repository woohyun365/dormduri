'use client';

import { useMatchingRequestClock } from '../hooks/useMatchingRequestClock';

export function RequestExpiryText(props: {
  readonly serverNow: string;
  readonly expiresAt: string;
  readonly roomSelectionDate: string | null;
}) {
  const timing = useMatchingRequestClock(props);
  const prefix = timing.limitingEvent === 'cutoff' ? '호실 선택 마감 기준' : '요청 만료까지';
  const announcement =
    timing.kind === 'expired'
      ? timing.label
      : timing.totalSeconds <= 3_600
        ? '요청 처리 기한이 1시간 이내로 남았어요.'
        : timing.totalSeconds <= 86_400
          ? '요청 처리 기한이 하루 이내로 남았어요.'
          : '';
  return (
    <>
      <p className="text-xs leading-5 text-(--knu-text-secondary)">
        {timing.kind === 'remaining' ? `${prefix} ${timing.label}` : timing.label}
      </p>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </>
  );
}
