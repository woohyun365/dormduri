'use client';

import { useMatchingRequestClock } from '../hooks/useMatchingRequestClock';

function toThresholdAnnouncement(timing: ReturnType<typeof useMatchingRequestClock>) {
  if (timing.kind === 'expired') return timing.label;
  if (timing.totalSeconds <= 3_600) return '요청 처리 기한이 1시간 이내로 남았어요.';
  if (timing.totalSeconds <= 86_400) return '요청 처리 기한이 하루 이내로 남았어요.';
  return '';
}

export function RequestExpiryText(props: {
  readonly serverNow: string;
  readonly expiresAt: string;
  readonly roomSelectionDate: string | null;
}) {
  const timing = useMatchingRequestClock(props);
  const prefix = timing.limitingEvent === 'cutoff' ? '호실 선택 마감 기준' : '요청 만료까지';
  // clock은 label 경계에서만 갱신된다. 같은 threshold의 minute/hour label 갱신에서는
  // 문자열이 같으므로 live region이 초 단위 countdown을 다시 알리지 않는다.
  const announcement = toThresholdAnnouncement(timing);

  return (
    <>
      <p className="text-xs leading-5 text-(--knu-text-secondary)">
        {timing.kind === 'remaining' ? `${prefix} ${timing.label}` : timing.label}
      </p>
      <span
        data-testid="matching-request-expiry-announcement"
        className="sr-only"
        aria-live="polite"
      >
        {announcement}
      </span>
    </>
  );
}
