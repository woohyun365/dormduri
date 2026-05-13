import { z } from 'zod';
import { collegeCodeSchema } from './college-contract.js';
import { LIFESTYLE_FIELD_OPTIONS } from './lifestyle.js';
import {
  additionalProfileSchema,
  MIN_PROFILE_BIRTH_YEAR,
  profileGradeSchema,
  profileMbtiSchema,
  profileRelationToViewerSchema,
  profileSourceSchema,
  publicProfileActionCapabilitiesSchema,
  publicProfileMatchScoreSchema,
} from './profile-contract.js';

const nullableEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional();

export const roommateSearchScopeSchema = z.enum(['CAMPUS_MERGED', 'SAME_BUILDING_ONLY']);
export const roommateSearchSortSchema = z.enum(['NICKNAME', 'MATCH_SCORE']);
export const roommateSearchSleepHabitFilterSchema = z.union([
  z.enum(LIFESTYLE_FIELD_OPTIONS.sleepHabit),
  z.literal('HAS'),
]);

export const roommateSearchQuerySchema = z.strictObject({
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  scope: roommateSearchScopeSchema.optional(),
  sort: roommateSearchSortSchema.optional(),
  smokingBehavior: nullableEnum(LIFESTYLE_FIELD_OPTIONS.smokingBehavior),
  bedtime: nullableEnum(LIFESTYLE_FIELD_OPTIONS.bedtime),
  wakeTime: nullableEnum(LIFESTYLE_FIELD_OPTIONS.wakeTime),
  noiseSensitivity: nullableEnum(LIFESTYLE_FIELD_OPTIONS.noiseSensitivity),
  cleanLevel: nullableEnum(LIFESTYLE_FIELD_OPTIONS.cleanLevel),
  sleepHabit: roommateSearchSleepHabitFilterSchema.optional(),
  indoorEating: nullableEnum(LIFESTYLE_FIELD_OPTIONS.indoorEating),
  relationshipStyle: nullableEnum(LIFESTYLE_FIELD_OPTIONS.relationshipStyle),
  college: collegeCodeSchema.optional(),
  grade: profileGradeSchema.optional(),
  mbti: profileMbtiSchema.optional(),
  birthYear: z.coerce.number().int().min(MIN_PROFILE_BIRTH_YEAR).optional(),
});

export const roommateSearchVisibilityModeSchema = z.enum([
  'LIMITED_ONLY',
  'MIXED_VISIBILITY',
  'FULL_ONLY',
]);

export const roommateSearchScopeCapabilitiesSchema = z.strictObject({
  campusMerged: z.boolean(),
  sameBuildingOnly: z.boolean(),
});

export const roommateSearchFilterCapabilitiesSchema = z.strictObject({
  smokingBehavior: z.boolean(),
  bedtime: z.boolean(),
  wakeTime: z.boolean(),
  noiseSensitivity: z.boolean(),
  cleanLevel: z.boolean(),
  sleepHabit: z.boolean(),
  indoorEating: z.boolean(),
  relationshipStyle: z.boolean(),
  college: z.boolean(),
  grade: z.boolean(),
  mbti: z.boolean(),
  birthYear: z.boolean(),
});

export const roommateSearchSortCapabilitiesSchema = z.strictObject({
  matchScore: z.boolean(),
});

const roommateSearchSummaryBaseSchema = z.strictObject({
  id: z.string(),
  sourceProfile: profileSourceSchema,
  relationToViewer: profileRelationToViewerSchema,
  actions: publicProfileActionCapabilitiesSchema,
  canViewFull: z.boolean(),
  nickname: z.string(),
  intro: z.string(),
  messageToRoommate: z.string().nullable(),
  additional: additionalProfileSchema,
});

export const roommateSearchLimitedSummarySchema = roommateSearchSummaryBaseSchema.extend({
  canViewFull: z.literal(false),
});

export const roommateSearchViewableSummarySchema = roommateSearchSummaryBaseSchema.extend({
  canViewFull: z.literal(true),
  matchScore: publicProfileMatchScoreSchema.shape.matchScore,
});

export const roommateSearchSummarySchema = z.union([
  roommateSearchLimitedSummarySchema,
  roommateSearchViewableSummarySchema,
]);

export const roommateSearchResponseSchema = z.strictObject({
  scope: roommateSearchScopeSchema,
  appliedSort: roommateSearchSortSchema,
  effectiveVisibility: roommateSearchVisibilityModeSchema,
  scopeCapabilities: roommateSearchScopeCapabilitiesSchema,
  filterCapabilities: roommateSearchFilterCapabilitiesSchema,
  sortCapabilities: roommateSearchSortCapabilitiesSchema,
  items: z.array(roommateSearchSummarySchema),
});

export type RoommateSearchQuery = z.infer<typeof roommateSearchQuerySchema>;
export type RoommateSearchResponse = z.infer<typeof roommateSearchResponseSchema>;
export type RoommateSearchScope = z.infer<typeof roommateSearchScopeSchema>;
export type RoommateSearchSort = z.infer<typeof roommateSearchSortSchema>;
export type RoommateSearchVisibilityMode = z.infer<typeof roommateSearchVisibilityModeSchema>;
export type RoommateSearchSummary = z.infer<typeof roommateSearchSummarySchema>;
