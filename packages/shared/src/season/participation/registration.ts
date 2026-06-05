import { z } from 'zod';
import { isoDateTimeStringSchema } from '../../date-primitives.js';
import { seasonParticipationCompletionStateSchema } from './state.js';

export const seasonRegistrationFinalizeRequestSchema = z.strictObject({});

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

export type SeasonRegistrationFinalizeRequest = z.infer<
  typeof seasonRegistrationFinalizeRequestSchema
>;
export type SeasonRegistrationFinalizeResponse = z.infer<
  typeof seasonRegistrationFinalizeResponseSchema
>;
