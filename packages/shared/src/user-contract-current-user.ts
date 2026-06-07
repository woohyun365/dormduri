import { z } from 'zod';
import { dormitorySelectionStateSchema } from './dormitory/enums.js';
import { seasonStateSchema } from './season/runtime/primitives.js';
import {
  seasonParticipationCompletionStateSchema,
  seasonParticipationStateSchema,
} from './season/participation/index.js';
import { activeMatchSummarySchema } from './match-contract.js';
import {
  displayIdentityEditUnavailableReasonSchema,
  userDisplayIdentitySchema,
} from './display-identity-contract.js';
import {
  academicIdentityEditUnavailableReasonSchema,
  userAcademicIdentitySchema,
} from './academic-identity-contract.js';
import { accountIdentityIncompleteErrorSchema } from './account-identity-contract.js';
import {
  authenticatedSessionUserSchema,
  participationIntentSchema,
  selectionSourceSchema,
} from './user-contract-primitives.js';

export const SERVICE_INTRO_NOTICE_KEY = 'service-intro' as const;
export const dismissedNoticeKeySchema = z.literal(SERVICE_INTRO_NOTICE_KEY);

export const dismissedNoticeStateSchema = z.strictObject({
  noticeKey: dismissedNoticeKeySchema,
  dismissed: z.boolean(),
  dismissedAt: z.string().nullable(),
});

export const currentUserSeasonProfileStateSchema = z.strictObject({
  hasCurrentSeason: z.boolean(),
  hasParticipantRow: z.boolean(),
  intent: participationIntentSchema.nullable(),
  registered: z.boolean(),
  profileExists: z.boolean(),
  profileState: seasonParticipationStateSchema.shape.profileState,
  completion: seasonParticipationCompletionStateSchema,
  draftWritable: z.boolean(),
  canSelectDormitory: z.boolean(),
  canFinalizeRegistration: z.boolean(),
});

export const currentUserResponseSchema = z.strictObject({
  user: authenticatedSessionUserSchema,
  displayIdentity: userDisplayIdentitySchema,
  academicIdentity: userAcademicIdentitySchema,
  seasonProfile: currentUserSeasonProfileStateSchema,
  selection: z.strictObject({
    state: dormitorySelectionStateSchema,
    dormitoryId: z.string().nullable(),
    source: selectionSourceSchema,
  }),
  match: z.strictObject({
    hasActiveMatch: z.boolean(),
    activeMatch: activeMatchSummarySchema.nullable(),
  }),
  capabilities: z.strictObject({
    canEnterRoommateSearch: z.boolean(),
    canCreateOrUpdateSeasonProfileDraft: z.boolean(),
    canSelectDormitory: z.boolean(),
    canFinalizeSeasonRegistration: z.boolean(),
    canEditDisplayIdentity: z.boolean(),
    displayIdentityEditUnavailableReasons: z.array(displayIdentityEditUnavailableReasonSchema),
    canEditAcademicIdentity: z.boolean(),
    academicIdentityEditUnavailableReasons: z.array(academicIdentityEditUnavailableReasonSchema),
    canBookmark: z.boolean(),
    canRequestMatch: z.boolean(),
    canStartChat: z.boolean(),
  }),
  onboarding: z.strictObject({
    dismissedNotices: z.array(dismissedNoticeStateSchema),
  }),
  serviceState: z.strictObject({
    campusOperated: z.boolean(),
    seasonState: seasonStateSchema.nullable(),
  }),
});

export type DismissedNoticeKey = z.infer<typeof dismissedNoticeKeySchema>;
export const currentUserAccountIdentityIncompleteErrorSchema = accountIdentityIncompleteErrorSchema;

export type DismissedNoticeState = z.infer<typeof dismissedNoticeStateSchema>;
export type CurrentUserSeasonProfileState = z.infer<typeof currentUserSeasonProfileStateSchema>;
export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;
export type CurrentUserAccountIdentityIncompleteError = z.infer<
  typeof currentUserAccountIdentityIncompleteErrorSchema
>;
