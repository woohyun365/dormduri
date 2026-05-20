import { z } from 'zod';
import { nicknameSchema } from './auth-contract-primitives.js';
import { dismissedNoticeKeySchema } from './user-contract-current-user.js';

export const updateCurrentUserDisplayIdentityRequestSchema = z.strictObject({
  nickname: nicknameSchema,
});

export const updateCurrentUserRequestSchema = z.strictObject({
  displayIdentity: updateCurrentUserDisplayIdentityRequestSchema.optional(),
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
export type UpdateCurrentUserRequest = z.infer<typeof updateCurrentUserRequestSchema>;
export type DismissCurrentUserOnboardingNoticeRequest = z.infer<
  typeof dismissCurrentUserOnboardingNoticeRequestSchema
>;
export type RequestAccountDeletion = z.infer<typeof requestAccountDeletionSchema>;
export type AccountDeletionRequestAccepted = z.infer<typeof accountDeletionRequestAcceptedSchema>;
