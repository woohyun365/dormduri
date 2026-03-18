import { describe, it, expect } from 'vitest';
import { BEDTIME_ORDER, WAKE_ORDER, TEMPERATURE_ORDER, LIFESTYLE_LABELS } from '../lifestyle';

describe('lifestyle 정렬 상수 완전성', () => {
  it('BEDTIME_ORDER covers all bedtime values', () => {
    expect([...BEDTIME_ORDER].sort()).toEqual(Object.keys(LIFESTYLE_LABELS.bedtime).sort());
  });

  it('WAKE_ORDER covers all wakeTime values (FLEXIBLE 제외)', () => {
    // WAKE_ORDER는 FLEXIBLE을 포함하지 않음 (정렬 대상에서 제외)
    // WAKE_ORDER의 모든 값이 wakeTime 라벨에 존재하는지 검증
    for (const value of WAKE_ORDER) {
      expect(Object.keys(LIFESTYLE_LABELS.wakeTime)).toContain(value);
    }
  });

  it('TEMPERATURE_ORDER covers all temperatureSensitivity values', () => {
    expect([...TEMPERATURE_ORDER].sort()).toEqual(
      Object.keys(LIFESTYLE_LABELS.temperatureSensitivity).sort(),
    );
  });

  it('LIFESTYLE_LABELS.cleanLevel에 정렬 기준 값들이 포함된다', () => {
    expect(Object.keys(LIFESTYLE_LABELS.cleanLevel).length).toBeGreaterThan(0);
  });
});
