import { z } from 'zod';
import { collegeCodeSchema } from './college/index.js';
import { LIFESTYLE_FIELD_OPTIONS } from './lifestyle/index.js';
import {
  profileGradeSchema,
  profileSourceSchema,
  publicProfileActionCapabilitiesSchema,
  publicProfileMatchScoreSchema,
  publicTargetExposureSchema,
  publicTargetRelationSchema,
  publicTargetResultReadSchema,
} from './profile-contract.js';

const nullableEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional();

const arrayFromQueryValue = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return Array.from(value as readonly unknown[]);
  }
  return [value];
};

const normalizeDottedRoommateSearchQuery = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const input = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...input };

  if ('college.operator' in input || 'college.values[]' in input || 'college.values' in input) {
    normalized.college = {
      operator: input['college.operator'],
      values: input['college.values[]'] ?? input['college.values'],
    };
    delete normalized['college.operator'];
    delete normalized['college.values[]'];
    delete normalized['college.values'];
  }

  if ('grade.operator' in input || 'grade.values[]' in input || 'grade.values' in input) {
    normalized.grade = {
      operator: input['grade.operator'],
      values: input['grade.values[]'] ?? input['grade.values'],
    };
    delete normalized['grade.operator'];
    delete normalized['grade.values[]'];
    delete normalized['grade.values'];
  }

  if (
    'mbtiTraits.energy' in input ||
    'mbtiTraits.perception' in input ||
    'mbtiTraits.decision' in input ||
    'mbtiTraits.lifestyle' in input
  ) {
    normalized.mbtiTraits = {
      energy: input['mbtiTraits.energy'],
      perception: input['mbtiTraits.perception'],
      decision: input['mbtiTraits.decision'],
      lifestyle: input['mbtiTraits.lifestyle'],
    };
    delete normalized['mbtiTraits.energy'];
    delete normalized['mbtiTraits.perception'];
    delete normalized['mbtiTraits.decision'];
    delete normalized['mbtiTraits.lifestyle'];
  }

  if ('ageBand.values[]' in input || 'ageBand.values' in input) {
    normalized.ageBand = {
      values: input['ageBand.values[]'] ?? input['ageBand.values'],
    };
    delete normalized['ageBand.values[]'];
    delete normalized['ageBand.values'];
  }

  return normalized;
};

export const roommateSearchScopeSchema = z.enum(['CAMPUS_MERGED', 'SAME_BUILDING_ONLY']);
export const roommateSearchPurposeSchema = z.enum([
  'BROAD_PREVIEW',
  'ACTIONABLE_DETAIL_DISCOVERY',
  'POST_MATCH_COHORT_REVIEW',
]);
export const roommateSearchSortSchema = z.enum(['NICKNAME', 'MATCH_SCORE']);
export const ROOMMATE_SEARCH_MIN_SCORE_PRESETS = [90, 80, 70, 60] as const;
export const roommateSearchMinScorePresetSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value),
  z.union([
    z.literal(ROOMMATE_SEARCH_MIN_SCORE_PRESETS[0]),
    z.literal(ROOMMATE_SEARCH_MIN_SCORE_PRESETS[1]),
    z.literal(ROOMMATE_SEARCH_MIN_SCORE_PRESETS[2]),
    z.literal(ROOMMATE_SEARCH_MIN_SCORE_PRESETS[3]),
  ]),
);
export const roommateSearchAvailabilityNoticeCodeSchema = z.enum([
  'MATCHED_TARGETS_EXCLUDED',
  'DISCOVERY_ACTIONABLE_ONLY',
  'SCOPE_RESTRICTED_BY_VIEWER_STATE',
  'POST_MATCH_ACTION_CLOSED',
  'DETAIL_UNAVAILABLE_BY_POLICY',
  'FILTER_RESULT_EMPTY',
]);
export const roommateSearchAvailabilityNoticeSeveritySchema = z.enum(['INFO', 'WARNING']);
export const roommateSearchSleepHabitFilterSchema = z.union([
  z.enum(LIFESTYLE_FIELD_OPTIONS.sleepHabit),
  z.literal('HAS'),
]);
export const roommateSearchFilterOperatorSchema = z.enum(['INCLUDE', 'EXCLUDE']);
export const roommateSearchAgeBandSchema = z.enum(['19', '20', '21', '22', '23', '24', '25_PLUS']);
export const roommateSearchMbtiTraitsSchema = z.strictObject({
  energy: z.enum(['E', 'I']).nullable().optional(),
  perception: z.enum(['N', 'S']).nullable().optional(),
  decision: z.enum(['T', 'F']).nullable().optional(),
  lifestyle: z.enum(['J', 'P']).nullable().optional(),
});
export const roommateSearchCollegeFilterSchema = z.strictObject({
  operator: roommateSearchFilterOperatorSchema,
  values: z.preprocess(arrayFromQueryValue, z.array(collegeCodeSchema).min(1)),
});
export const roommateSearchGradeFilterSchema = z.strictObject({
  operator: roommateSearchFilterOperatorSchema,
  values: z.preprocess(arrayFromQueryValue, z.array(profileGradeSchema).min(1)),
});
export const roommateSearchAgeBandFilterSchema = z.strictObject({
  values: z.preprocess(arrayFromQueryValue, z.array(roommateSearchAgeBandSchema).min(1)),
});

export const roommateSearchQuerySchema = z.preprocess(
  normalizeDottedRoommateSearchQuery,
  z.strictObject({
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
    college: roommateSearchCollegeFilterSchema.optional(),
    grade: roommateSearchGradeFilterSchema.optional(),
    mbtiTraits: roommateSearchMbtiTraitsSchema.optional(),
    ageBand: roommateSearchAgeBandFilterSchema.optional(),
    minScore: roommateSearchMinScorePresetSchema.optional(),
  }),
);

export const roommateSearchManifestQuerySchema = z.strictObject({
  scope: roommateSearchScopeSchema.optional(),
});

export const roommateSearchScopeAvailabilitySchema = z.strictObject({
  campusMerged: z.boolean(),
  sameBuildingOnly: z.boolean(),
});

export const roommateSearchFilterOptionSchema = z.strictObject({
  code: z.string(),
  label: z.string(),
});

export const roommateSearchFilterManifestSourceSchema = z.enum([
  'SHARED_ENUM',
  'SHARED_MBTI_TRAITS',
  'SEASON_REFERENCE_YEAR',
  'VIEWER_CAMPUS_ACTIVE_CATALOG',
  'LIFESTYLE_FIELD_OPTIONS',
  'COLLEGE_REFERENCE',
  'PROFILE_ENUM',
  'MBTI_TRAITS',
  'AGE_BAND',
  'MATCH_SCORE_PRESET',
]);

export const roommateSearchFilterFieldManifestSchema = z.strictObject({
  enabled: z.boolean(),
  source: roommateSearchFilterManifestSourceSchema.optional(),
  operators: z.array(roommateSearchFilterOperatorSchema).optional(),
  options: z.array(roommateSearchFilterOptionSchema).optional(),
  disabledReason: z.string().optional(),
});

export const roommateSearchFilterManifestSchema = z.strictObject({
  enabled: z.boolean(),
  fields: z.record(z.string(), roommateSearchFilterFieldManifestSchema),
});

export const roommateSearchSortManifestSchema = z.strictObject({
  default: roommateSearchSortSchema,
  options: z.array(roommateSearchSortSchema).min(1),
});

export const roommateSearchManifestSchema = z.strictObject({
  manifestRevision: z.string().min(1),
  scope: roommateSearchScopeSchema,
  purpose: roommateSearchPurposeSchema,
  filters: roommateSearchFilterManifestSchema,
  sorts: roommateSearchSortManifestSchema,
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

export const roommateSearchBookmarkStateSchema = z.strictObject({
  bookmarked: z.boolean(),
  bookmarkedAt: z.string().datetime().optional(),
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
    bookmark: roommateSearchBookmarkStateSchema.optional(),
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
  manifest: roommateSearchManifestSchema,
  pageInfo: roommateSearchPageInfoSchema,
  availabilityNotices: z.array(roommateSearchAvailabilityNoticeSchema),
  items: z.array(roommateSearchSummarySchema),
});

export const roommateSearchManifestResponseSchema = z.strictObject({
  scope: roommateSearchScopeSchema,
  scopeAvailability: roommateSearchScopeAvailabilitySchema,
  manifest: roommateSearchManifestSchema,
  availabilityNotices: z.array(roommateSearchAvailabilityNoticeSchema),
});

export type RoommateSearchQuery = z.infer<typeof roommateSearchQuerySchema>;
export type RoommateSearchManifestQuery = z.infer<typeof roommateSearchManifestQuerySchema>;
export type RoommateSearchResponse = z.infer<typeof roommateSearchResponseSchema>;
export type RoommateSearchManifestResponse = z.infer<typeof roommateSearchManifestResponseSchema>;
export type RoommateSearchScope = z.infer<typeof roommateSearchScopeSchema>;
export type RoommateSearchPurpose = z.infer<typeof roommateSearchPurposeSchema>;
export type RoommateSearchSort = z.infer<typeof roommateSearchSortSchema>;
export type RoommateSearchMinScorePreset = z.infer<typeof roommateSearchMinScorePresetSchema>;
export type RoommateSearchFilterOperator = z.infer<typeof roommateSearchFilterOperatorSchema>;
export type RoommateSearchAgeBand = z.infer<typeof roommateSearchAgeBandSchema>;
export type RoommateSearchMbtiTraits = z.infer<typeof roommateSearchMbtiTraitsSchema>;
export type RoommateSearchAvailabilityNoticeCode = z.infer<
  typeof roommateSearchAvailabilityNoticeCodeSchema
>;
export type RoommateSearchAvailabilityNotice = z.infer<
  typeof roommateSearchAvailabilityNoticeSchema
>;
export type RoommateSearchManifest = z.infer<typeof roommateSearchManifestSchema>;
export type RoommateSearchResultSummary = z.infer<typeof roommateSearchResultSummarySchema>;
export type RoommateSearchPageInfo = z.infer<typeof roommateSearchPageInfoSchema>;
export type RoommateSearchProfileSummary = z.infer<typeof roommateSearchProfileSummarySchema>;
export type RoommateSearchSummary = z.infer<typeof roommateSearchSummarySchema>;
