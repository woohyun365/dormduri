import { z } from 'zod';
import { lifestyleSchema } from '../../lifestyle/index.js';
import {
  additionalProfileSchema,
  seasonAdditionalProfileDraftSchema,
} from '../../profile/contract/fields.js';
import { seasonParticipationCompletionStateSchema, seasonProfileStateSchema } from './state.js';

export const seasonProfileDraftRequestSchema = z.strictObject({
  lifestyle: lifestyleSchema,
  intro: z.string().trim().max(200).optional().default(''),
  additional: additionalProfileSchema,
});

export const createSeasonProfileRequestSchema = seasonProfileDraftRequestSchema;
export const updateSeasonProfileRequestSchema = seasonProfileDraftRequestSchema;

export const seasonProfileDraftResponseSchema = z.strictObject({
  participantId: z.string().nullable(),
  seasonId: z.string(),
  state: seasonProfileStateSchema,
  lifestyle: lifestyleSchema,
  intro: z.string(),
  additional: seasonAdditionalProfileDraftSchema,
  completion: seasonParticipationCompletionStateSchema,
  draftWritable: z.boolean(),
});

export type SeasonProfileDraftRequest = z.infer<typeof seasonProfileDraftRequestSchema>;
export type CreateSeasonProfileRequest = z.infer<typeof createSeasonProfileRequestSchema>;
export type UpdateSeasonProfileRequest = z.infer<typeof updateSeasonProfileRequestSchema>;
export type SeasonProfileDraftResponse = z.infer<typeof seasonProfileDraftResponseSchema>;
