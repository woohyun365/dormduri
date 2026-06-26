export function formatDateDot(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export function calcDaysUntilTimestamp(targetTs: number, nowTs: number): number {
  return Math.max(0, Math.ceil((targetTs - nowTs) / (1000 * 60 * 60 * 24)));
}
