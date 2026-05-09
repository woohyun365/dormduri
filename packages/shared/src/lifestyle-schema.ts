import { z } from 'zod';
import { LIFESTYLE_FIELD_OPTIONS, REQUIRED_LIFESTYLE_FIELDS } from './lifestyle-options.js';

const nullableEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).nullable();

export const lifestyleSchema = z
  .strictObject({
    bedtime: nullableEnum(LIFESTYLE_FIELD_OPTIONS.bedtime),
    wakeTime: nullableEnum(LIFESTYLE_FIELD_OPTIONS.wakeTime),
    sleepHabit: nullableEnum(LIFESTYLE_FIELD_OPTIONS.sleepHabit),
    sleepEnvironment: nullableEnum(LIFESTYLE_FIELD_OPTIONS.sleepEnvironment),
    screenUsage: nullableEnum(LIFESTYLE_FIELD_OPTIONS.screenUsage),
    noiseSensitivity: nullableEnum(LIFESTYLE_FIELD_OPTIONS.noiseSensitivity),
    smokingBehavior: nullableEnum(LIFESTYLE_FIELD_OPTIONS.smokingBehavior),
    indoorEating: nullableEnum(LIFESTYLE_FIELD_OPTIONS.indoorEating),
    phoneBehavior: nullableEnum(LIFESTYLE_FIELD_OPTIONS.phoneBehavior),
    earphoneUsage: nullableEnum(LIFESTYLE_FIELD_OPTIONS.earphoneUsage),
    cleanLevel: nullableEnum(LIFESTYLE_FIELD_OPTIONS.cleanLevel),
    drinkingFrequency: nullableEnum(LIFESTYLE_FIELD_OPTIONS.drinkingFrequency),
    relationshipStyle: nullableEnum(LIFESTYLE_FIELD_OPTIONS.relationshipStyle),
    temperatureSensitivity: nullableEnum(LIFESTYLE_FIELD_OPTIONS.temperatureSensitivity),
    smokingTolerance: nullableEnum(LIFESTYLE_FIELD_OPTIONS.smokingTolerance),
    phoneTolerance: nullableEnum(LIFESTYLE_FIELD_OPTIONS.phoneTolerance),
    earphoneExpectation: nullableEnum(LIFESTYLE_FIELD_OPTIONS.earphoneExpectation),
    sleepEnvPreference: nullableEnum(LIFESTYLE_FIELD_OPTIONS.sleepEnvPreference),
    screenTolerance: nullableEnum(LIFESTYLE_FIELD_OPTIONS.screenTolerance),
    indoorEatingTolerance: nullableEnum(LIFESTYLE_FIELD_OPTIONS.indoorEatingTolerance),
    cleanExpectation: nullableEnum(LIFESTYLE_FIELD_OPTIONS.cleanExpectation),
    drinkingTolerance: nullableEnum(LIFESTYLE_FIELD_OPTIONS.drinkingTolerance),
  })
  .superRefine((value, ctx) => {
    for (const field of REQUIRED_LIFESTYLE_FIELDS) {
      if (value[field] === null) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `${field} 필드는 필수입니다.`,
        });
      }
    }

    if (value.screenUsage === 'NONE' && value.sleepEnvironment !== 'QUIET') {
      ctx.addIssue({
        code: 'custom',
        path: ['sleepEnvironment'],
        message: 'screenUsage가 NONE일 때 sleepEnvironment는 QUIET이어야 합니다.',
      });
    }
  });

export type LifestyleData = z.infer<typeof lifestyleSchema>;
export type Bedtime = LifestyleData['bedtime'];
export type WakeTime = LifestyleData['wakeTime'];
export type SleepHabit = LifestyleData['sleepHabit'];
export type SleepEnvironment = LifestyleData['sleepEnvironment'];
export type ScreenUsage = LifestyleData['screenUsage'];
export type NoiseSensitivity = LifestyleData['noiseSensitivity'];
export type SmokingBehavior = LifestyleData['smokingBehavior'];
export type IndoorEating = LifestyleData['indoorEating'];
export type PhoneBehavior = LifestyleData['phoneBehavior'];
export type EarphoneUsage = LifestyleData['earphoneUsage'];
export type CleanLevel = LifestyleData['cleanLevel'];
export type DrinkingFrequency = LifestyleData['drinkingFrequency'];
export type RelationshipStyle = LifestyleData['relationshipStyle'];
export type TemperatureSensitivity = LifestyleData['temperatureSensitivity'];
export type SmokingTolerance = LifestyleData['smokingTolerance'];
export type PhoneTolerance = LifestyleData['phoneTolerance'];
export type EarphoneExpectation = LifestyleData['earphoneExpectation'];
export type SleepEnvPreference = LifestyleData['sleepEnvPreference'];
export type ScreenTolerance = LifestyleData['screenTolerance'];
export type IndoorEatingTolerance = LifestyleData['indoorEatingTolerance'];
export type CleanExpectation = LifestyleData['cleanExpectation'];
export type DrinkingTolerance = LifestyleData['drinkingTolerance'];
