import { describe, it, expect } from 'vitest';
import {
  BEDTIME_ORDER,
  WAKE_ORDER,
  NOISE_ORDER,
  CLEAN_ORDER,
  LIFESTYLE_LABELS,
} from '../lifestyle';

describe('lifestyle 정렬 상수 완전성', () => {
  it('BEDTIME_ORDER covers all bedtime values', () => {
    expect([...BEDTIME_ORDER].sort()).toEqual(Object.keys(LIFESTYLE_LABELS.bedtime).sort());
  });

  it('WAKE_ORDER covers all wakeTime values', () => {
    expect([...WAKE_ORDER].sort()).toEqual(Object.keys(LIFESTYLE_LABELS.wakeTime).sort());
  });

  it('NOISE_ORDER covers all noiseSensitivity values', () => {
    expect([...NOISE_ORDER].sort()).toEqual(Object.keys(LIFESTYLE_LABELS.noiseSensitivity).sort());
  });

  it('CLEAN_ORDER covers all cleanliness values', () => {
    expect([...CLEAN_ORDER].sort()).toEqual(Object.keys(LIFESTYLE_LABELS.cleanliness).sort());
  });
});
