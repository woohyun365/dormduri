import { describe, expect, it } from 'vitest';
import {
  calcDaysUntilDate,
  endOfMonthDate,
  formatKstDate,
  subtractDays,
  toKstEndMs,
  toKstStartMs,
} from './kst-date.js';

describe('KST date helpers', () => {
  it('formats UTC instants as KST local dates', () => {
    expect(formatKstDate(new Date('2026-02-10T14:59:59.000Z'))).toBe('2026-02-10');
    expect(formatKstDate(new Date('2026-02-10T15:00:00.000Z'))).toBe('2026-02-11');
  });

  it('resolves KST day boundaries for local date strings', () => {
    expect(new Date(toKstStartMs('2026-02-10')).toISOString()).toBe('2026-02-09T15:00:00.000Z');
    expect(new Date(toKstEndMs('2026-02-10')).toISOString()).toBe('2026-02-10T14:59:59.000Z');
  });

  it('handles month end and local-date arithmetic', () => {
    expect(endOfMonthDate(2028, 2)).toBe('2028-02-29');
    expect(subtractDays('2026-03-01', 1)).toBe('2026-02-28');
    expect(subtractDays('2026-02-28', -1)).toBe('2026-03-01');
  });

  it('counts remaining days until a KST local date end', () => {
    expect(calcDaysUntilDate('2026-02-12', new Date('2026-02-10T03:00:00.000Z'))).toBe(3);
    expect(calcDaysUntilDate('2026-02-12', new Date('2026-02-12T15:00:00.000Z'))).toBe(0);
  });
});
