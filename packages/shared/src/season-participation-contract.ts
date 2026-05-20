import { z } from 'zod';
import { dormitoryGenderPolicySchema, dormitoryRoomTypeSchema } from './dormitory-contract.js';
import { campusSchema } from './identity-contract.js';
import { lifestyleSchema } from './lifestyle.js';
import { additionalProfileSchema } from './profile-contract-fields.js';
import { seasonStateSchema } from './season-contract-primitives.js';
import { participationIntentSchema } from './user-contract-primitives.js';
import { isoDateTimeStringSchema, localDateStringSchema } from './date-primitives.js';

export const seasonProfileStateSchema = z.enum([
  'NONE',
  'DRAFT',
  'COMPLETE',
  'REGISTRATION_FINALIZED',
]);

export const seasonRegistrationBlockReasonSchema = z.enum([
  'NO_CURRENT_SEASON',
  'UNSUPPORTED_CAMPUS',
  'SEASON_NOT_OPEN',
  'PROFILE_INCOMPLETE',
  'DORMITORY_SELECTION_REQUIRED',
  'NO_SELECTABLE_DORMITORY',
  'DORMITORY_SELECTION_CLOSED',
  'WITHDRAWN_OR_DECLINED_LOCK',
  'ACCOUNT_OR_PARTICIPANT_INACTIVE',
]);

export const seasonParticipationCompletionStateSchema = z.strictObject({
  profileCompletionRequired: z.boolean(),
  dormitorySelectionRequired: z.boolean(),
  registrationUnavailable: z.boolean(),
  registrationUnavailableReasons: z.array(seasonRegistrationBlockReasonSchema),
});

export const seasonProfileDraftRequestSchema = z.strictObject({
  lifestyle: lifestyleSchema,
  intro: z.string().trim().min(1).max(200),
  additional: additionalProfileSchema.optional(),
});

export const createSeasonProfileRequestSchema = seasonProfileDraftRequestSchema;
export const updateSeasonProfileRequestSchema = seasonProfileDraftRequestSchema;

export const seasonProfileDraftResponseSchema = z.strictObject({
  participantId: z.string(),
  seasonId: z.string(),
  state: seasonProfileStateSchema,
  lifestyle: lifestyleSchema,
  intro: z.string(),
  additional: additionalProfileSchema,
  completion: seasonParticipationCompletionStateSchema,
  draftWritable: z.boolean(),
});

export const selectableDormitorySchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  campusCode: campusSchema,
  roomType: dormitoryRoomTypeSchema,
  genderPolicy: dormitoryGenderPolicySchema,
  roomSelectionDate: localDateStringSchema,
});

export const selectableDormitoriesResponseSchema = z.strictObject({
  seasonId: z.string(),
  seasonState: seasonStateSchema,
  profileState: seasonProfileStateSchema,
  completion: seasonParticipationCompletionStateSchema,
  items: z.array(selectableDormitorySchema),
});

export const selectedDormitorySubmitRequestSchema = z.strictObject({
  dormitoryId: z.string(),
});

export const seasonRegistrationFinalizeResponseSchema = z.strictObject({
  seasonId: z.string(),
  participantId: z.string(),
  participationIntent: z.literal('REGISTERED'),
  registeredAt: isoDateTimeStringSchema,
  dormitorySelectionState: z.literal('ASSIGNED'),
  dormitoryId: z.string(),
  profileState: z.literal('REGISTRATION_FINALIZED'),
  profileHistoryId: z.string(),
  registeredAtSnapshot: isoDateTimeStringSchema,
  completion: seasonParticipationCompletionStateSchema,
});

export const seasonParticipationStateSchema = z.strictObject({
  hasCurrentSeason: z.boolean(),
  hasParticipantRow: z.boolean(),
  intent: participationIntentSchema.nullable(),
  registered: z.boolean(),
  profileExists: z.boolean(),
  profileState: seasonProfileStateSchema,
  completion: seasonParticipationCompletionStateSchema,
});

export type SeasonProfileState = z.infer<typeof seasonProfileStateSchema>;
export type SeasonRegistrationBlockReason = z.infer<typeof seasonRegistrationBlockReasonSchema>;
export type SeasonParticipationCompletionState = z.infer<
  typeof seasonParticipationCompletionStateSchema
>;
export type SeasonProfileDraftRequest = z.infer<typeof seasonProfileDraftRequestSchema>;
export type CreateSeasonProfileRequest = z.infer<typeof createSeasonProfileRequestSchema>;
export type UpdateSeasonProfileRequest = z.infer<typeof updateSeasonProfileRequestSchema>;
export type SeasonProfileDraftResponse = z.infer<typeof seasonProfileDraftResponseSchema>;
export type SelectableDormitory = z.infer<typeof selectableDormitorySchema>;
export type SelectableDormitoriesResponse = z.infer<typeof selectableDormitoriesResponseSchema>;
export type SelectedDormitorySubmitRequest = z.infer<typeof selectedDormitorySubmitRequestSchema>;
export type SeasonRegistrationFinalizeResponse = z.infer<
  typeof seasonRegistrationFinalizeResponseSchema
>;
export type SeasonParticipationState = z.infer<typeof seasonParticipationStateSchema>;
