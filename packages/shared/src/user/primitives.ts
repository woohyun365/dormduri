import { z } from 'zod';
import { campusSchema, genderSchema } from '../identity/primitives.js';

export const authenticatedSessionUserSchema = z.strictObject({
  id: z.string(),
  email: z.string(),
  nickname: z.string(),
  gender: genderSchema,
  campus: campusSchema,
});

export const participationIntentSchema = z.enum(['UNDECIDED', 'REGISTERED', 'DECLINED']);
export const selectionSourceSchema = z.literal('SEASON_PARTICIPANT');

export type AuthenticatedSessionUser = z.infer<typeof authenticatedSessionUserSchema>;
export type ParticipationIntent = z.infer<typeof participationIntentSchema>;
export type SelectionSource = z.infer<typeof selectionSourceSchema>;
