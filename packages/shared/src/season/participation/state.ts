import { z } from 'zod';
import { dormitorySelectionStateSchema } from '../../dormitory/enums.js';
import { participationIntentSchema } from '../../user-contract-primitives.js';

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

export const seasonParticipationStateSchema = z.strictObject({
  hasCurrentSeason: z.boolean(),
  hasParticipantRow: z.boolean(),
  intent: participationIntentSchema.nullable(),
  registered: z.boolean(),
  profileExists: z.boolean(),
  profileState: seasonProfileStateSchema,
  dormitorySelectionState: dormitorySelectionStateSchema,
  dormitoryId: z.string().nullable(),
  completion: seasonParticipationCompletionStateSchema,
});

export type SeasonProfileState = z.infer<typeof seasonProfileStateSchema>;
export type SeasonRegistrationBlockReason = z.infer<typeof seasonRegistrationBlockReasonSchema>;
export type SeasonParticipationCompletionState = z.infer<
  typeof seasonParticipationCompletionStateSchema
>;
export type SeasonParticipationState = z.infer<typeof seasonParticipationStateSchema>;
