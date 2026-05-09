import { z } from 'zod';
import { lifestyleSchema } from './lifestyle.js';
import { additionalProfileSchema, profileSourceSchema } from './profile-contract.js';
import { dormitorySelectionStateSchema } from './dormitory-contract.js';
import { seasonStateSchema } from './season-contract.js';
import { activeMatchSummarySchema } from './match-contract.js';
import {
  authenticatedSessionUserSchema,
  participationIntentSchema,
  selectionSourceSchema,
} from './user-contract-primitives.js';

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
  match: z.strictObject({
    hasActiveMatch: z.boolean(),
    activeMatch: activeMatchSummarySchema.nullable(),
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

export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;
