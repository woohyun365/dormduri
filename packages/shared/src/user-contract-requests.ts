import { z } from 'zod';
import { nicknameSchema } from './auth/contract/primitives.js';
import { userAcademicIdentitySchema } from './academic-identity-contract.js';
import {
  currentUserResponseSchema,
  dismissedNoticeKeySchema,
} from './user-contract-current-user.js';

export const updateCurrentUserDisplayIdentityRequestSchema = z.strictObject({
  nickname: nicknameSchema,
});

export const updateCurrentUserAcademicIdentityRequestSchema = userAcademicIdentitySchema;

export const updateCurrentUserRequestSchema = z.strictObject({
  displayIdentity: updateCurrentUserDisplayIdentityRequestSchema.optional(),
  academicIdentity: updateCurrentUserAcademicIdentityRequestSchema.optional(),
});

export const updateCurrentUserDisplayIdentityNoOpReasonSchema = z.enum(['SAME_NICKNAME']);
export const updateCurrentUserAcademicIdentityNoOpReasonSchema = z.enum(['SAME_ACADEMIC_IDENTITY']);

export const updateCurrentUserDisplayIdentityMutationResultSchema = z.strictObject({
  attempted: z.boolean(),
  changed: z.boolean(),
  noOpReason: updateCurrentUserDisplayIdentityNoOpReasonSchema.nullable(),
});

export const updateCurrentUserAcademicIdentityMutationResultSchema = z.strictObject({
  attempted: z.boolean(),
  changed: z.boolean(),
  noOpReason: updateCurrentUserAcademicIdentityNoOpReasonSchema.nullable(),
});

export const updateCurrentUserResponseSchema = z.strictObject({
  currentUser: currentUserResponseSchema,
  mutation: z.strictObject({
    displayIdentity: updateCurrentUserDisplayIdentityMutationResultSchema,
    academicIdentity: updateCurrentUserAcademicIdentityMutationResultSchema,
  }),
});

export const dismissCurrentUserOnboardingNoticeRequestSchema = z.strictObject({
  noticeKey: dismissedNoticeKeySchema,
});

export const requestAccountDeletionSchema = z.strictObject({
  password: z.string().min(1),
});

export const accountDeletionRequestAcceptedSchema = z.strictObject({
  state: z.literal('DEIDENTIFIED_RETAINED'),
  deletedAt: z.string(),
  retentionHoldUntil: z.string().nullable(),
});

export type UpdateCurrentUserDisplayIdentityRequest = z.infer<
  typeof updateCurrentUserDisplayIdentityRequestSchema
>;
export type UpdateCurrentUserAcademicIdentityRequest = z.infer<
  typeof updateCurrentUserAcademicIdentityRequestSchema
>;
export type UpdateCurrentUserRequest = z.infer<typeof updateCurrentUserRequestSchema>;
export type UpdateCurrentUserDisplayIdentityNoOpReason = z.infer<
  typeof updateCurrentUserDisplayIdentityNoOpReasonSchema
>;
export type UpdateCurrentUserAcademicIdentityNoOpReason = z.infer<
  typeof updateCurrentUserAcademicIdentityNoOpReasonSchema
>;
export type UpdateCurrentUserDisplayIdentityMutationResult = z.infer<
  typeof updateCurrentUserDisplayIdentityMutationResultSchema
>;
export type UpdateCurrentUserAcademicIdentityMutationResult = z.infer<
  typeof updateCurrentUserAcademicIdentityMutationResultSchema
>;
export type UpdateCurrentUserResponse = z.infer<typeof updateCurrentUserResponseSchema>;
export type DismissCurrentUserOnboardingNoticeRequest = z.infer<
  typeof dismissCurrentUserOnboardingNoticeRequestSchema
>;
export type RequestAccountDeletion = z.infer<typeof requestAccountDeletionSchema>;
export type AccountDeletionRequestAccepted = z.infer<typeof accountDeletionRequestAcceptedSchema>;
