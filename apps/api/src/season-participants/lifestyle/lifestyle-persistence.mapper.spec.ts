import { describe, expect, it } from 'vitest';
import type { LifestyleData } from '@repo/shared/lifestyle';
import {
  lifestyleColumnSelect,
  lifestyleFieldNames,
  toCompleteLifestyleColumnData,
  toLifestyleColumnData,
  toLifestyleFromColumns,
  toStoredBedtime,
  toStoredWakeTime,
} from './lifestyle-persistence.mapper.js';

const completeLifestyle = {
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
  earphoneExpectation: 'MUST',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'LOW_OK',
  indoorEatingTolerance: 'NO_SMELL',
  cleanExpectation: 'STRICT',
  drinkingTolerance: 'LOW_ONLY',
} satisfies LifestyleData;

describe('lifestyle-persistence.mapper', () => {
  it('keeps the season profile column select in sync with lifestyle fields', () => {
    expect(Object.keys(lifestyleColumnSelect).sort()).toEqual([...lifestyleFieldNames].sort());
  });

  it('maps shared lifestyle enum aliases to stored Prisma enum values and back', () => {
    expect(toStoredBedtime('22_24')).toBe('BETWEEN_22_24');
    expect(toStoredWakeTime('07_08')).toBe('BETWEEN_07_08');

    const stored = toLifestyleColumnData(completeLifestyle);

    expect(stored).toMatchObject({
      bedtime: 'BETWEEN_22_24',
      wakeTime: 'BETWEEN_07_08',
    });
    expect(toLifestyleFromColumns(stored)).toEqual(completeLifestyle);
  });

  it('rejects incomplete lifestyle when complete column data is required', () => {
    expect(() => toCompleteLifestyleColumnData({ ...completeLifestyle, bedtime: null })).toThrow(
      '[lifestyle.persistence] complete lifestyle is required',
    );
  });
});
