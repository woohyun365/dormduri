import { z } from 'zod';
import { campusSchema, genderSchema } from './identity-contract.js';
import { additionalProfileSchema, publicLifestyleSchema } from './profile-contract-fields.js';

export const profileSourceSchema = z.enum(['USER_PROFILE', 'SEASON_PARTICIPANT_PROFILE']);
export const profileExposureLevelSchema = z.enum(['LIMITED', 'FULL']);
export const profileRelationToViewerSchema = z.enum(['GENERAL', 'MATCHED_PARTNER']);

export const publicProfileActionCapabilitiesSchema = z.strictObject({
  canBookmark: z.boolean(),
  canRequestMatch: z.boolean(),
  canStartChat: z.boolean(),
});

export const publicProfileMatchScoreSchema = z.strictObject({
  matchScore: z.number().int().min(0).max(100),
});

const publicProfileBaseSchema = z
  .strictObject({
    id: z.string(),
    exposureLevel: profileExposureLevelSchema,
    sourceProfile: profileSourceSchema,
    relationToViewer: profileRelationToViewerSchema,
    actions: publicProfileActionCapabilitiesSchema,
    nickname: z.string(),
    intro: z.string(),
    messageToRoommate: z.string().nullable(),
    additional: additionalProfileSchema,
  })
  .extend({
    matchScore: publicProfileMatchScoreSchema.shape.matchScore.optional(),
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

export type ProfileSource = z.infer<typeof profileSourceSchema>;
export type ProfileExposureLevel = z.infer<typeof profileExposureLevelSchema>;
export type ProfileRelationToViewer = z.infer<typeof profileRelationToViewerSchema>;
export type PublicProfileActionCapabilities = z.infer<typeof publicProfileActionCapabilitiesSchema>;
export type LimitedPublicProfile = z.infer<typeof limitedPublicProfileSchema>;
export type FullPublicProfile = z.infer<typeof fullPublicProfileSchema>;
export type PublicProfile = z.infer<typeof publicProfileSchema>;
export type PublicProfileListResponse = z.infer<typeof publicProfileListResponseSchema>;
