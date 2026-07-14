import { describe, expect, it } from 'vitest';
import {
  CORE_LIFESTYLE_FIELDS,
  lifestyleSchema,
  ROOMMATE_CONDITION_FIELDS,
  type LifestyleData,
} from '@repo/shared/lifestyle';

const VALID_LIFESTYLE: LifestyleData = {
  bedtime: '22_24',
  wakeTime: '07_08',
  sleepHabit: 'NONE',
  sleepEnvironment: 'QUIET',
  screenUsage: 'NONE',
  noiseSensitivity: 'NORMAL',
  smokingBehavior: 'NO',
  indoorEating: 'SNACK',
  phoneBehavior: 'SOMETIMES',
  earphoneUsage: 'MOSTLY',
  cleanLevel: 'WEEKLY_3_UP',
  drinkingFrequency: 'NONE',
  relationshipStyle: 'CLOSE',
  temperatureSensitivity: 'NORMAL',
  smokingTolerance: 'NO_ONLY',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'LOW_VOLUME_OK',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'LOW_OK',
  indoorEatingTolerance: 'CLEAN_OK',
  cleanExpectation: 'BASIC',
  drinkingTolerance: 'LOW_ONLY',
};

describe('lifestyle reference contract', () => {
  it('lifestyle schema는 필수 필드 null과 screen/sleep invariant를 계속 강제한다', () => {
    const missingRequired = lifestyleSchema.safeParse({
      ...VALID_LIFESTYLE,
      [CORE_LIFESTYLE_FIELDS[0]]: null,
    });
    expect(missingRequired.success).toBe(true);

    const inconsistentSleep = lifestyleSchema.safeParse({
      ...VALID_LIFESTYLE,
      screenUsage: 'NONE',
      sleepEnvironment: 'EARPHONE',
    });
    expect(inconsistentSleep.success).toBe(false);

    for (const field of ROOMMATE_CONDITION_FIELDS) {
      const optionalCondition = lifestyleSchema.safeParse({
        ...VALID_LIFESTYLE,
        [field]: null,
      });
      expect(optionalCondition.success).toBe(true);
    }
  });
});
