import { z } from 'zod';
import { collegeCodeSchema } from './college-contract.js';
import { LIFESTYLE_FIELD_OPTIONS } from './lifestyle.js';
import {
  MIN_PROFILE_BIRTH_YEAR,
  profileGradeSchema,
  profileMbtiSchema,
  profileSourceSchema,
  publicProfileActionCapabilitiesSchema,
  publicProfileMatchScoreSchema,
  publicTargetExposureSchema,
  publicTargetRelationSchema,
  publicTargetResultReadSchema,
} from './profile-contract.js';

const nullableEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional();

export const roommateSearchScopeSchema = z.enum(['CAMPUS_MERGED', 'SAME_BUILDING_ONLY']);
export const roommateSearchSortSchema = z.enum(['NICKNAME', 'MATCH_SCORE']);
export const roommateSearchAvailabilityNoticeCodeSchema = z.enum([
  'MATCHED_TARGETS_EXCLUDED',
  'DISCOVERY_ACTIONABLE_ONLY',
  'SCOPE_RESTRICTED_BY_VIEWER_STATE',
  'POST_MATCH_ACTION_CLOSED',
  'DETAIL_UNAVAILABLE_BY_POLICY',
]);
export const roommateSearchAvailabilityNoticeSeveritySchema = z.enum(['INFO', 'WARNING']);
export const roommateSearchSleepHabitFilterSchema = z.union([
  z.enum(LIFESTYLE_FIELD_OPTIONS.sleepHabit),
  z.literal('HAS'),
]);

export const roommateSearchQuerySchema = z.strictObject({
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  cursor: z.string().trim().min(1).optional(),
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

export const roommateSearchScopeAvailabilitySchema = z.strictObject({
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

export const roommateSearchResultSummarySchema = z.strictObject({
  summaryOnlyCount: z.number().int().nonnegative(),
  detailViewableCount: z.number().int().nonnegative(),
  scoreVisibleCount: z.number().int().nonnegative(),
});

export const roommateSearchPageInfoSchema = z.strictObject({
  hasNextPage: z.boolean(),
  nextCursor: z.string().nullable(),
});

export const roommateSearchAvailabilityNoticeSchema = z.strictObject({
  code: roommateSearchAvailabilityNoticeCodeSchema,
  severity: roommateSearchAvailabilityNoticeSeveritySchema,
  message: z.string().optional(),
});

export const roommateSearchProfileSummarySchema = z.strictObject({
  nickname: z.string(),
  intro: z.string(),
  smokingBehavior: z.enum(LIFESTYLE_FIELD_OPTIONS.smokingBehavior).nullable(),
  sleepHabit: z.enum(LIFESTYLE_FIELD_OPTIONS.sleepHabit).nullable(),
  relationshipStyle: z.enum(LIFESTYLE_FIELD_OPTIONS.relationshipStyle).nullable(),
});

export const roommateSearchSummarySchema = z
  .strictObject({
    id: z.string(),
    sourceProfile: profileSourceSchema,
    relation: publicTargetRelationSchema,
    exposure: publicTargetExposureSchema,
    actions: publicProfileActionCapabilitiesSchema,
    resultRead: publicTargetResultReadSchema,
    profileSummary: roommateSearchProfileSummarySchema,
    detailEntryToken: z.string().optional(),
  })
  .extend({
    matchScore: publicProfileMatchScoreSchema.shape.matchScore.optional(),
  });

export const roommateSearchResponseSchema = z.strictObject({
  scope: roommateSearchScopeSchema,
  appliedSort: roommateSearchSortSchema,
  resultSummary: roommateSearchResultSummarySchema,
  scopeAvailability: roommateSearchScopeAvailabilitySchema,
  filterCapabilities: roommateSearchFilterCapabilitiesSchema,
  sortCapabilities: roommateSearchSortCapabilitiesSchema,
  pageInfo: roommateSearchPageInfoSchema,
  availabilityNotices: z.array(roommateSearchAvailabilityNoticeSchema),
  items: z.array(roommateSearchSummarySchema),
});

export type RoommateSearchQuery = z.infer<typeof roommateSearchQuerySchema>;
export type RoommateSearchResponse = z.infer<typeof roommateSearchResponseSchema>;
export type RoommateSearchScope = z.infer<typeof roommateSearchScopeSchema>;
export type RoommateSearchSort = z.infer<typeof roommateSearchSortSchema>;
export type RoommateSearchAvailabilityNoticeCode = z.infer<
  typeof roommateSearchAvailabilityNoticeCodeSchema
>;
export type RoommateSearchAvailabilityNotice = z.infer<
  typeof roommateSearchAvailabilityNoticeSchema
>;
export type RoommateSearchResultSummary = z.infer<typeof roommateSearchResultSummarySchema>;
export type RoommateSearchPageInfo = z.infer<typeof roommateSearchPageInfoSchema>;
export type RoommateSearchProfileSummary = z.infer<typeof roommateSearchProfileSummarySchema>;
export type RoommateSearchSummary = z.infer<typeof roommateSearchSummarySchema>;
