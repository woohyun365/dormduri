import type { LocalDateString } from '@repo/shared/date';

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function formatKstDate(date: Date): LocalDateString {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function endOfMonthDate(year: number, month1Based: number): LocalDateString {
  const date = new Date(Date.UTC(year, month1Based, 0));
  return date.toISOString().slice(0, 10);
}

export function subtractDays(dateStr: LocalDateString, days: number): LocalDateString {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function toKstStartMs(dateStr: LocalDateString): number {
  return new Date(`${dateStr}T00:00:00+09:00`).getTime();
}

export function toKstEndMs(dateStr: LocalDateString): number {
  return new Date(`${dateStr}T23:59:59+09:00`).getTime();
}

export function toKstStartIso(dateStr: LocalDateString): string {
  return new Date(toKstStartMs(dateStr)).toISOString();
}

export function toKstEndIso(dateStr: LocalDateString): string {
  return new Date(toKstEndMs(dateStr)).toISOString();
}

export function calcDaysUntilDate(dateStr: LocalDateString, now: Date): number {
  const diff = toKstEndMs(dateStr) - now.getTime();
  return Math.max(0, Math.ceil(diff / DAY_MS));
}
