import { z } from 'zod';
import { campusSchema, genderSchema } from './identity-contract.js';
import { additionalProfileSchema, publicLifestyleSchema } from './profile-contract-fields.js';

export const profileSourceSchema = z.enum(['SEASON_PARTICIPANT_PROFILE']);
export const profileRelationToViewerSchema = z.enum(['GENERAL', 'MATCHED_PARTNER']);

export const publicProfileActionCapabilitiesSchema = z.strictObject({
  canBookmark: z.boolean(),
  canRequestMatch: z.boolean(),
  canStartChat: z.boolean(),
});

export const publicProfileCapabilitySchema = z.strictObject({
  summaryVisible: z.literal(true),
  detailViewable: z.literal(true),
  canViewFull: z.literal(true),
  scoreVisible: z.boolean(),
  actions: publicProfileActionCapabilitiesSchema,
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

export const publicProfileSchema = z
  .strictObject({
    id: z.string(),
    sourceProfile: profileSourceSchema,
    relationToViewer: profileRelationToViewerSchema,
    capabilities: publicProfileCapabilitySchema,
    nickname: z.string(),
    intro: z.string(),
    additional: additionalProfileSchema,
    gender: genderSchema,
    campus: campusSchema,
    lifestyle: publicProfileDetailLifestyleSchema,
  })
  .extend({
    matchScore: publicProfileMatchScoreSchema.shape.matchScore.optional(),
  });

export const publicProfileListResponseSchema = z.strictObject({
  items: z.array(publicProfileSchema),
});

export type ProfileSource = z.infer<typeof profileSourceSchema>;
export type ProfileRelationToViewer = z.infer<typeof profileRelationToViewerSchema>;
export type PublicProfileActionCapabilities = z.infer<typeof publicProfileActionCapabilitiesSchema>;
export type PublicProfileCapability = z.infer<typeof publicProfileCapabilitySchema>;
export type PublicProfileMatchScore = z.infer<typeof publicProfileMatchScoreSchema>;
export type PublicProfileDetailLifestyle = z.infer<typeof publicProfileDetailLifestyleSchema>;
export type PublicProfile = z.infer<typeof publicProfileSchema>;
export type PublicProfileListResponse = z.infer<typeof publicProfileListResponseSchema>;
