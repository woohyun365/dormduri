interface AuthRemainingTimeProps {
  value: string;
  contextLabel: string;
}

export function formatAuthRemainingTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  if (minutes === 0) return `${remainingSeconds}초`;
  if (remainingSeconds === 0) return `${minutes}분`;
  return `${minutes}분 ${remainingSeconds}초`;
}

export function formatCompactAuthRemainingTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  if (safeSeconds < 60) return `${safeSeconds}초`;

  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function AuthRemainingTime({ value, contextLabel }: AuthRemainingTimeProps) {
  return (
    <p
      className="mt-1 text-xs font-medium text-amber-700"
      role="timer"
      aria-live="off"
      aria-label={`${contextLabel} 남은 시간 ${value}`}
    >
      남은 시간: <strong className="ml-1 font-bold tabular-nums">{value}</strong>
    </p>
  );
}
