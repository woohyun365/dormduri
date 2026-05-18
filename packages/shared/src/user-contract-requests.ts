import { z } from 'zod';
import {
  profileBirthYearSchema,
  profileGradeSchema,
  profileMbtiInputSchema,
} from './profile-contract.js';
import { collegeCodeSchema } from './college-contract.js';

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

export const requestAccountDeletionSchema = z.strictObject({
  password: z.string().min(1),
});

export const accountDeletionRequestAcceptedSchema = z.strictObject({
  state: z.literal('DEIDENTIFIED_RETAINED'),
  deletedAt: z.string(),
  retentionHoldUntil: z.string().nullable(),
});

export type UpdateCurrentUserRequest = z.infer<typeof updateCurrentUserRequestSchema>;
export type RequestAccountDeletion = z.infer<typeof requestAccountDeletionSchema>;
export type AccountDeletionRequestAccepted = z.infer<typeof accountDeletionRequestAcceptedSchema>;
