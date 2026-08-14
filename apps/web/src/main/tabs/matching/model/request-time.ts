export type RequestCountdown =
  | { readonly kind: 'expired' }
  | { readonly kind: 'remaining'; readonly totalSeconds: number; readonly label: string };

export type RequestTiming =
  | {
      readonly kind: 'expired';
      readonly label: string;
      readonly limitingEvent: 'expiry' | 'cutoff';
    }
  | {
      readonly kind: 'remaining';
      readonly totalSeconds: number;
      readonly label: string;
      readonly limitingEvent: 'expiry' | 'cutoff';
    };

function formatRemaining(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return days > 0 ? `${days}일 ${hours}시간 남음` : `${hours}시간 ${minutes}분 남음`;
}

function roomSelectionCutoffAt(roomSelectionDate: string | null): number | null {
  if (!roomSelectionDate) return null;
  const parsed = Date.parse(`${roomSelectionDate}T23:59:59.999+09:00`);
  return Number.isFinite(parsed) ? parsed : null;
}

/** server snapshot에 monotonic elapsed만 더한 user-facing 시간 모델이다. 권한 판정에는 사용하지 않는다. */
export function getRequestTiming(input: {
  readonly serverNow: string;
  readonly expiresAt: string;
  readonly roomSelectionDate: string | null;
  readonly elapsedMs?: number;
}): RequestTiming {
  const now = Date.parse(input.serverNow) + (input.elapsedMs ?? 0);
  const expiry = Date.parse(input.expiresAt);
  const cutoff = roomSelectionCutoffAt(input.roomSelectionDate);
  const limitingEvent = cutoff !== null && cutoff < expiry ? 'cutoff' : 'expiry';
  const target = limitingEvent === 'cutoff' ? cutoff : expiry;
  const seconds = Math.floor(((target ?? expiry) - now) / 1000);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return {
      kind: 'expired',
      label:
        limitingEvent === 'cutoff' ? '기숙사 선택 마감일이 지났어요' : '요청 유효 시간이 지났어요',
      limitingEvent,
    };
  }
  return {
    kind: 'remaining',
    totalSeconds: seconds,
    label: formatRemaining(seconds),
    limitingEvent,
  };
}

/** API snapshot의 serverNow만 기준으로 표시하며 action 가능 여부를 다시 판정하지 않는다. */
export function getRequestCountdown(input: {
  readonly serverNow: string;
  readonly expiresAt: string;
}): RequestCountdown {
  const seconds = Math.floor((Date.parse(input.expiresAt) - Date.parse(input.serverNow)) / 1000);
  if (!Number.isFinite(seconds) || seconds <= 0) return { kind: 'expired' };
  return { kind: 'remaining', totalSeconds: seconds, label: formatRemaining(seconds) };
}
