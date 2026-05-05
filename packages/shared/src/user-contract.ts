import { z } from 'zod';
import { campusSchema, genderSchema } from './identity-contract.js';
import { lifestyleSchema } from './lifestyle.js';
import {
  additionalProfileSchema,
  profileBirthYearSchema,
  profileGradeSchema,
  profileMbtiInputSchema,
  profileSourceSchema,
} from './profile-contract.js';
import { dormitorySelectionStateSchema } from './dormitory-contract.js';
import { seasonStateSchema } from './season-contract.js';
import { collegeCodeSchema } from './college-contract.js';

export const authenticatedSessionUserSchema = z.strictObject({
  id: z.string(),
  email: z.string(),
  nickname: z.string(),
  gender: genderSchema,
  campus: campusSchema,
});

export const participationIntentSchema = z.enum(['UNDECIDED', 'REGISTERED', 'DECLINED']);
export const selectionSourceSchema = z.enum(['USER', 'SEASON_PARTICIPANT']);

export const currentUserResponseSchema = z.strictObject({
  user: authenticatedSessionUserSchema,
  selection: z.strictObject({
    state: dormitorySelectionStateSchema,
    dormitoryId: z.string().nullable(),
    source: selectionSourceSchema,
  }),
  profile: z.strictObject({
    source: profileSourceSchema,
    lifestyle: lifestyleSchema,
    intro: z.string(),
    messageToRoommate: z.string().nullable(),
    additional: additionalProfileSchema,
  }),
  participation: z.strictObject({
    hasCurrentSeason: z.boolean(),
    hasParticipantRow: z.boolean(),
    intent: participationIntentSchema.nullable(),
    registered: z.boolean(),
    profileExists: z.boolean(),
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
    canBrowseProfiles: z.boolean(),
    canRegisterParticipation: z.boolean(),
    canSelectDormitory: z.boolean(),
    canEditLifestyle: z.boolean(),
    canEditNickname: z.boolean(),
    canEditProfileText: z.boolean(),
    canBookmark: z.boolean(),
    canRequestMatch: z.boolean(),
    canStartChat: z.boolean(),
    profileEdit: z.strictObject({
      intro: z.boolean(),
      messageToRoommate: z.boolean(),
      additional: z.boolean(),
      lifestyle: z.boolean(),
      nickname: z.boolean(),
    }),
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
  college: collegeCodeSchema.nullable().optional(),
  grade: profileGradeSchema.nullable().optional(),
  mbti: profileMbtiInputSchema.nullable().optional(),
  birthYear: profileBirthYearSchema.nullable().optional(),
});

export const updateCurrentUserRequestSchema = z.strictObject({
  selection: selectionPatchSchema.optional(),
  intro: z.string().max(200).optional(),
  messageToRoommate: z.string().max(100).nullable().optional(),
  additional: additionalProfilePatchSchema.optional(),
});

export type AuthenticatedSessionUser = z.infer<typeof authenticatedSessionUserSchema>;
export type ParticipationIntent = z.infer<typeof participationIntentSchema>;
export type SelectionSource = z.infer<typeof selectionSourceSchema>;
export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;
export type UpdateCurrentUserRequest = z.infer<typeof updateCurrentUserRequestSchema>;
