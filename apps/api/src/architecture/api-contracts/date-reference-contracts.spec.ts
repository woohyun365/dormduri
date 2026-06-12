import { describe, expect, it } from 'vitest';
import { isLocalDateString, toDateOnlyString, toIsoDateTimeString } from '@repo/shared/date';

describe('date reference contract', () => {
  it('date primitives는 local/iso normalization과 guard를 유지한다', () => {
    expect(isLocalDateString('2026-05-09')).toBe(true);
    expect(isLocalDateString('2026/05/09')).toBe(false);
    expect(toDateOnlyString(new Date('2026-05-09T10:00:00.000Z'))).toBe('2026-05-09');
    expect(toIsoDateTimeString('2026-05-09T10:00:00.000Z')).toBe('2026-05-09T10:00:00.000Z');
  });
});
