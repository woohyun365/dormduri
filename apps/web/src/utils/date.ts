export function formatDateDot(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDateSpaced(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}`;
}

export function formatMonthDay(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}. ${date.getDate()}`;
}

export function calcDaysUntilTimestamp(targetTs: number, nowTs: number): number {
  return Math.max(0, Math.ceil((targetTs - nowTs) / (1000 * 60 * 60 * 24)));
}

export function calcDaysUntilKstDate(dateStr: string, nowTs: number): number {
  const targetTs = new Date(`${dateStr}T00:00:00+09:00`).getTime();
  return calcDaysUntilTimestamp(targetTs, nowTs);
}
