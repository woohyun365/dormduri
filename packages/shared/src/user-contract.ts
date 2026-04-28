import { z } from 'zod';
import { campusSchema, genderSchema } from './identity-contract.js';
import { lifestyleSchema } from './lifestyle.js';
import { additionalProfileSchema } from './profile-contract.js';
import { dormitorySelectionStateSchema } from './dormitory-contract.js';
import { seasonStateSchema } from './season-contract.js';

export const authenticatedSessionUserSchema = z.strictObject({
  id: z.string(),
  email: z.string(),
  nickname: z.string(),
  gender: genderSchema,
  campus: campusSchema,
});

export const currentUserResponseSchema = z.strictObject({
  user: authenticatedSessionUserSchema,
  selection: z.strictObject({
    state: dormitorySelectionStateSchema,
    dormitoryId: z.string().nullable(),
  }),
  profile: z.strictObject({
    lifestyle: lifestyleSchema,
    intro: z.string(),
    messageToRoommate: z.string().nullable(),
    additional: additionalProfileSchema,
  }),
  readiness: z.strictObject({
    requiredCompletedCount: z.number().int().nonnegative(),
    requiredTotalCount: z.number().int().positive(),
    requiredComplete: z.boolean(),
    optionalCompletedCount: z.number().int().nonnegative(),
    optionalTotalCount: z.number().int().positive(),
    optionalComplete: z.boolean(),
    selectionState: dormitorySelectionStateSchema,
    canBrowseProfiles: z.boolean(),
  }),
  capabilities: z.strictObject({
    canSelectDormitory: z.boolean(),
    canEditLifestyle: z.boolean(),
    canEditNickname: z.boolean(),
    canEditProfileText: z.boolean(),
    canBookmark: z.boolean(),
    canRequestMatch: z.boolean(),
  }),
  serviceState: z.strictObject({
    campusOperated: z.boolean(),
    seasonState: seasonStateSchema.nullable(),
  }),
});

export const selectionPatchSchema = z.strictObject({
  state: z.enum(['UNASSIGNED', 'ASSIGNED']),
  dormitoryId: z.string().nullable(),
});

export const additionalProfilePatchSchema = z.strictObject({
  college: z.string().nullable().optional(),
  grade: z.string().nullable().optional(),
  mbti: z.string().nullable().optional(),
  birthYear: z.number().int().nullable().optional(),
});

export const updateCurrentUserRequestSchema = z.strictObject({
  selection: selectionPatchSchema.optional(),
  intro: z.string().max(200).optional(),
  messageToRoommate: z.string().max(100).nullable().optional(),
  additional: additionalProfilePatchSchema.optional(),
});

export type AuthenticatedSessionUser = z.infer<typeof authenticatedSessionUserSchema>;
export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;
export type UpdateCurrentUserRequest = z.infer<typeof updateCurrentUserRequestSchema>;
