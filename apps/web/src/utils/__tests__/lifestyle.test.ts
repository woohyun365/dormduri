import { describe, it, expect } from 'vitest';
import { isConditionComplete, isLifestyleRequiredComplete } from '../lifestyle';
import { makeLifestyle } from '@/__fixtures__/test-helpers';
import { LIFESTYLE_EMPTY } from '@/__fixtures__/test-helpers';

// -- isConditionComplete --

describe('isConditionComplete', () => {
  it('조건 8개 전부 non-null이면 true', () => {
    const lifestyle = makeLifestyle();
    expect(isConditionComplete(lifestyle)).toBe(true);
  });

  it('조건 8개 중 하나라도 null이면 false', () => {
    const lifestyle = makeLifestyle({ smokingTolerance: null });
    expect(isConditionComplete(lifestyle)).toBe(false);
  });

  it('조건 8개 전부 null이면 false', () => {
    expect(isConditionComplete(LIFESTYLE_EMPTY)).toBe(false);
  });

  it('수면/생활 필드가 null이어도 조건 8개가 있으면 true', () => {
    const lifestyle = makeLifestyle({
      bedtime: null,
      wakeTime: null,
      smokingBehavior: null,
    });
    expect(isConditionComplete(lifestyle)).toBe(true);
  });

  it('각 조건 필드 개별 null 검증', () => {
    const conditionFields = [
      'smokingTolerance',
      'phoneTolerance',
      'earphoneExpectation',
      'sleepEnvPreference',
      'screenTolerance',
      'indoorEatingTolerance',
      'cleanExpectation',
      'drinkingTolerance',
    ] as const;

    for (const field of conditionFields) {
      const lifestyle = makeLifestyle({ [field]: null });
      expect(isConditionComplete(lifestyle)).toBe(false);
    }
  });
});

// -- isLifestyleRequiredComplete --

describe('isLifestyleRequiredComplete', () => {
  it('필수 15필드 전부 non-null이면 true', () => {
    const lifestyle = makeLifestyle();
    expect(isLifestyleRequiredComplete(lifestyle)).toBe(true);
  });

  it('전부 null이면 false', () => {
    expect(isLifestyleRequiredComplete(LIFESTYLE_EMPTY)).toBe(false);
  });

  it('수면 필드 1개 null이면 false', () => {
    const lifestyle = makeLifestyle({ bedtime: null });
    expect(isLifestyleRequiredComplete(lifestyle)).toBe(false);
  });

  it('생활 필드 1개 null이면 false', () => {
    const lifestyle = makeLifestyle({ smokingBehavior: null });
    expect(isLifestyleRequiredComplete(lifestyle)).toBe(false);
  });

  it('drinkingTolerance null이면 false', () => {
    const lifestyle = makeLifestyle({ drinkingTolerance: null });
    expect(isLifestyleRequiredComplete(lifestyle)).toBe(false);
  });

  it('선택 조건 7개 null이어도 true (drinkingTolerance 제외)', () => {
    const lifestyle = makeLifestyle({
      smokingTolerance: null,
      phoneTolerance: null,
      earphoneExpectation: null,
      sleepEnvPreference: null,
      screenTolerance: null,
      indoorEatingTolerance: null,
      cleanExpectation: null,
    });
    expect(isLifestyleRequiredComplete(lifestyle)).toBe(true);
  });

  it('수면 6개 전부 null이면 false', () => {
    const lifestyle = makeLifestyle({
      bedtime: null,
      wakeTime: null,
      sleepHabit: null,
      sleepEnvironment: null,
      screenUsage: null,
      noiseSensitivity: null,
    });
    expect(isLifestyleRequiredComplete(lifestyle)).toBe(false);
  });

  it('생활 8개 전부 null이면 false', () => {
    const lifestyle = makeLifestyle({
      smokingBehavior: null,
      indoorEating: null,
      phoneBehavior: null,
      earphoneUsage: null,
      cleanLevel: null,
      drinkingFrequency: null,
      relationshipStyle: null,
      temperatureSensitivity: null,
    });
    expect(isLifestyleRequiredComplete(lifestyle)).toBe(false);
  });
});
