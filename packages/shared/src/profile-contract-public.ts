import { z } from 'zod';
import { campusSchema, genderSchema } from './identity-contract.js';
import { publicProfileAdditionalSchema, publicLifestyleSchema } from './profile-contract-fields.js';

export const profileSourceSchema = z.enum(['SEASON_PARTICIPANT_PROFILE']);
export const profileRelationToViewerSchema = z.enum(['GENERAL', 'MATCHED_PARTNER']);
export const publicTargetResultReadContextSchema = z.enum([
  'NONE',
  'CURRENT_MATCHED_PARTNER',
  'PAST_MATCH_HISTORY',
  'EXISTING_THREAD',
]);
export const publicTargetActionUnavailableReasonSchema = z.enum([
  'VIEWER_NOT_REGISTERED',
  'VIEWER_PROFILE_INCOMPLETE',
  'VIEWER_NOT_ASSIGNED',
  'TARGET_NOT_PUBLIC',
  'DIFFERENT_DORMITORY',
  'VIEWER_ALREADY_MATCHED',
  'TARGET_ALREADY_MATCHED',
  'SEASON_NOT_ACTIONABLE',
  'ROOM_SELECTION_CUTOFF',
  'THREAD_READ_ONLY',
  'TARGET_DELETED_OR_DEIDENTIFIED',
  'SAFETY_OR_VISIBILITY_RESTRICTED',
]);
export const publicProfileDetailStateSchema = z.enum(['FULL', 'TOMBSTONE']);
export const publicProfileTombstoneReasonSchema = z.enum([
  'DETAIL_NOT_AVAILABLE_DIFFERENT_DORMITORY',
  'DETAIL_REQUIRES_REGISTRATION',
  'DETAIL_REQUIRES_ASSIGNED_DORMITORY',
  'DETAIL_CONTEXT_NO_LONGER_VALID',
  'TARGET_NO_LONGER_DISCOVERABLE',
]);

export const publicTargetRelationSchema = z.strictObject({
  type: profileRelationToViewerSchema,
});

export const publicTargetExposureSchema = z.strictObject({
  listSummaryVisible: z.boolean(),
  detailViewable: z.boolean(),
  canViewFull: z.boolean(),
  scoreVisible: z.boolean(),
});

export const publicTargetResultReadSchema = z.strictObject({
  resultReadable: z.boolean(),
  context: publicTargetResultReadContextSchema,
});

export const publicProfileActionCapabilitiesSchema = z.strictObject({
  canBookmark: z.boolean(),
  canRequestMatch: z.boolean(),
  canStartChat: z.boolean(),
  unavailableReasons: z.array(publicTargetActionUnavailableReasonSchema),
});

export const publicProfileMatchScoreSchema = z.strictObject({
  matchScore: z.number().int().min(0).max(100),
});

export const publicProfileDetailLifestyleSchema = publicLifestyleSchema.pick({
  bedtime: true,
  wakeTime: true,
  sleepHabit: true,
  sleepEnvironment: true,
  screenUsage: true,
  noiseSensitivity: true,
  smokingBehavior: true,
  indoorEating: true,
  phoneBehavior: true,
  earphoneUsage: true,
  cleanLevel: true,
  relationshipStyle: true,
  temperatureSensitivity: true,
});

export const publicProfileFullDetailSchema = z
  .strictObject({
    id: z.string(),
    detailState: z.literal('FULL'),
    sourceProfile: profileSourceSchema,
    relation: publicTargetRelationSchema,
    exposure: publicTargetExposureSchema,
    actions: publicProfileActionCapabilitiesSchema,
    resultRead: publicTargetResultReadSchema,
    nickname: z.string(),
    intro: z.string(),
    additional: publicProfileAdditionalSchema,
    gender: genderSchema,
    campus: campusSchema,
    lifestyle: publicProfileDetailLifestyleSchema,
  })
  .extend({
    matchScore: publicProfileMatchScoreSchema.shape.matchScore.optional(),
  });

export const publicProfileTombstoneSchema = z.strictObject({
  id: z.string(),
  detailState: z.literal('TOMBSTONE'),
  relation: publicTargetRelationSchema,
  exposure: publicTargetExposureSchema,
  actions: publicProfileActionCapabilitiesSchema,
  resultRead: publicTargetResultReadSchema,
  tombstone: z.strictObject({
    reason: publicProfileTombstoneReasonSchema,
    displayName: z.string(),
    message: z.string(),
  }),
});

export const publicProfileSchema = z.discriminatedUnion('detailState', [
  publicProfileFullDetailSchema,
  publicProfileTombstoneSchema,
]);

export const publicProfileListResponseSchema = z.strictObject({
  items: z.array(publicProfileSchema),
});

export type ProfileSource = z.infer<typeof profileSourceSchema>;
export type ProfileRelationToViewer = z.infer<typeof profileRelationToViewerSchema>;
export type PublicProfileDetailState = z.infer<typeof publicProfileDetailStateSchema>;
export type PublicTargetRelation = z.infer<typeof publicTargetRelationSchema>;
export type PublicTargetExposure = z.infer<typeof publicTargetExposureSchema>;
export type PublicTargetActionUnavailableReason = z.infer<
  typeof publicTargetActionUnavailableReasonSchema
>;
export type PublicProfileTombstoneReason = z.infer<typeof publicProfileTombstoneReasonSchema>;
export type PublicProfileActionCapabilities = z.infer<typeof publicProfileActionCapabilitiesSchema>;
export type PublicTargetResultReadContext = z.infer<typeof publicTargetResultReadContextSchema>;
export type PublicTargetResultRead = z.infer<typeof publicTargetResultReadSchema>;
export type PublicProfileMatchScore = z.infer<typeof publicProfileMatchScoreSchema>;
export type PublicProfileDetailLifestyle = z.infer<typeof publicProfileDetailLifestyleSchema>;
export type PublicProfileFullDetail = z.infer<typeof publicProfileFullDetailSchema>;
export type PublicProfileTombstone = z.infer<typeof publicProfileTombstoneSchema>;
export type PublicProfile = z.infer<typeof publicProfileSchema>;
export type PublicProfileListResponse = z.infer<typeof publicProfileListResponseSchema>;
