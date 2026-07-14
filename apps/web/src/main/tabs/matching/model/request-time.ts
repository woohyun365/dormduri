export type RequestCountdown =
  | { readonly kind: 'expired' }
  | { readonly kind: 'remaining'; readonly totalSeconds: number; readonly label: string };

/** API snapshot의 serverNow만 기준으로 표시하며 action 가능 여부를 다시 판정하지 않는다. */
export function getRequestCountdown(input: {
  readonly serverNow: string;
  readonly expiresAt: string;
}): RequestCountdown {
  const seconds = Math.floor((Date.parse(input.expiresAt) - Date.parse(input.serverNow)) / 1000);
  if (!Number.isFinite(seconds) || seconds <= 0) return { kind: 'expired' };
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const label = days > 0 ? `${days}일 ${hours}시간 남음` : `${hours}시간 ${minutes}분 남음`;
  return { kind: 'remaining', totalSeconds: seconds, label };
}
