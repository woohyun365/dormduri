import { z } from 'zod';
import { LIFESTYLE_FIELD_OPTIONS } from '../../lifestyle/index.js';
import { collegeCodeSchema } from '../../college/index.js';

const nullableEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).nullable();

export const PROFILE_GRADE_VALUES = ['1', '2', '3', '4+'] as const;
export const profileGradeSchema = z.enum(PROFILE_GRADE_VALUES);

export const PROFILE_MBTI_VALUES = [
  'ISTJ',
  'ISFJ',
  'INFJ',
  'INTJ',
  'ISTP',
  'ISFP',
  'INFP',
  'INTP',
  'ESTP',
  'ESFP',
  'ENFP',
  'ENTP',
  'ESTJ',
  'ESFJ',
  'ENFJ',
  'ENTJ',
] as const;
export const profileMbtiSchema = z.enum(PROFILE_MBTI_VALUES);
export const profileMbtiInputSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(profileMbtiSchema);

export const MIN_PROFILE_BIRTH_YEAR = 1980;
export const profileBirthYearSchema = z.number().int().min(MIN_PROFILE_BIRTH_YEAR);

export const additionalProfileSchema = z.strictObject({
  grade: profileGradeSchema,
  mbti: profileMbtiSchema,
});

export const seasonAdditionalProfileDraftSchema = z.strictObject({
  grade: profileGradeSchema.nullable(),
  mbti: profileMbtiSchema.nullable(),
});

export const publicProfileAdditionalSchema = z.strictObject({
  college: collegeCodeSchema.nullable(),
  grade: profileGradeSchema.nullable(),
  mbti: profileMbtiSchema.nullable(),
  birthYear: profileBirthYearSchema.nullable(),
});

export const publicLifestyleSchema = z.strictObject({
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
  relationshipStyle: nullableEnum(LIFESTYLE_FIELD_OPTIONS.relationshipStyle),
  temperatureSensitivity: nullableEnum(LIFESTYLE_FIELD_OPTIONS.temperatureSensitivity),
  smokingTolerance: nullableEnum(LIFESTYLE_FIELD_OPTIONS.smokingTolerance),
  phoneTolerance: nullableEnum(LIFESTYLE_FIELD_OPTIONS.phoneTolerance),
  earphoneExpectation: nullableEnum(LIFESTYLE_FIELD_OPTIONS.earphoneExpectation),
  sleepEnvPreference: nullableEnum(LIFESTYLE_FIELD_OPTIONS.sleepEnvPreference),
  screenTolerance: nullableEnum(LIFESTYLE_FIELD_OPTIONS.screenTolerance),
  indoorEatingTolerance: nullableEnum(LIFESTYLE_FIELD_OPTIONS.indoorEatingTolerance),
  cleanExpectation: nullableEnum(LIFESTYLE_FIELD_OPTIONS.cleanExpectation),
});

export type AdditionalProfile = z.infer<typeof additionalProfileSchema>;
export type SeasonAdditionalProfileDraft = z.infer<typeof seasonAdditionalProfileDraftSchema>;
export type PublicProfileAdditional = z.infer<typeof publicProfileAdditionalSchema>;
export type PublicLifestyle = z.infer<typeof publicLifestyleSchema>;
