import { z } from 'zod';
import { campusSchema, genderSchema } from './identity-contract.js';
import { LIFESTYLE_FIELD_OPTIONS } from './lifestyle.js';
import { collegeCodeSchema } from './college-contract.js';

const nullableEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).nullable();

export const PROFILE_GRADE_VALUES = ['1', '2', '3', '4+'] as const;
export const profileGradeSchema = z.enum(PROFILE_GRADE_VALUES);

const MBTI_REGEX = /^[EI][SN][TF][JP]$/;
export const profileMbtiSchema = z.string().regex(MBTI_REGEX);
export const profileMbtiInputSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(profileMbtiSchema);

export const MIN_PROFILE_BIRTH_YEAR = 1980;
export const profileBirthYearSchema = z.number().int().min(MIN_PROFILE_BIRTH_YEAR);

export const additionalProfileSchema = z.strictObject({
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

export const profileSourceSchema = z.enum(['USER_PROFILE', 'SEASON_PARTICIPANT_PROFILE']);
export const profileExposureLevelSchema = z.enum(['LIMITED', 'FULL']);
export const profileRelationToViewerSchema = z.enum(['GENERAL', 'MATCHED_PARTNER']);

export const publicProfileActionCapabilitiesSchema = z.strictObject({
  canBookmark: z.boolean(),
  canRequestMatch: z.boolean(),
  canStartChat: z.boolean(),
});

const publicProfileBaseSchema = z.strictObject({
  id: z.string(),
  exposureLevel: profileExposureLevelSchema,
  sourceProfile: profileSourceSchema,
  relationToViewer: profileRelationToViewerSchema,
  actions: publicProfileActionCapabilitiesSchema,
  nickname: z.string(),
  intro: z.string(),
  messageToRoommate: z.string().nullable(),
  additional: additionalProfileSchema,
});

export const limitedPublicProfileSchema = publicProfileBaseSchema.extend({
  exposureLevel: z.literal('LIMITED'),
});

export const fullPublicProfileSchema = publicProfileBaseSchema.extend({
  exposureLevel: z.literal('FULL'),
  gender: genderSchema,
  campus: campusSchema,
  lifestyle: publicLifestyleSchema,
});

export const publicProfileSchema = z.union([limitedPublicProfileSchema, fullPublicProfileSchema]);

export const publicProfileListResponseSchema = z.strictObject({
  items: z.array(publicProfileSchema),
});

export const profileListQuerySchema = z
  .strictObject({
    offset: z.coerce.number().int().nonnegative().optional().default(0),
    limit: z.coerce.number().int().positive().max(50).optional().default(20),
  })
  .default({ offset: 0, limit: 20 });

export const nicknamePatchRequestSchema = z.strictObject({
  nickname: z.string(),
});

export type AdditionalProfile = z.infer<typeof additionalProfileSchema>;
export type PublicLifestyle = z.infer<typeof publicLifestyleSchema>;
export type ProfileSource = z.infer<typeof profileSourceSchema>;
export type ProfileExposureLevel = z.infer<typeof profileExposureLevelSchema>;
export type ProfileRelationToViewer = z.infer<typeof profileRelationToViewerSchema>;
export type PublicProfileActionCapabilities = z.infer<typeof publicProfileActionCapabilitiesSchema>;
export type LimitedPublicProfile = z.infer<typeof limitedPublicProfileSchema>;
export type FullPublicProfile = z.infer<typeof fullPublicProfileSchema>;
export type PublicProfile = z.infer<typeof publicProfileSchema>;
export type PublicProfileListResponse = z.infer<typeof publicProfileListResponseSchema>;
export type ProfileListQuery = z.infer<typeof profileListQuerySchema>;
