import { z } from 'zod';
import { isoDateTimeStringSchema } from '../../date/primitives.js';
import { seasonProfileDraftResponseSchema } from './profile-draft.js';

export const previousSeasonProfileEmptyReasonSchema = z.enum([
  'NO_PREVIOUS_SEASON_PROFILE',
  'PROFILE_NOT_AVAILABLE',
]);

export const previousSeasonProfileFullSchema = seasonProfileDraftResponseSchema.extend({
  detailState: z.literal('FULL'),
  seasonName: z.string(),
  dormitoryId: z.string().nullable(),
  dormitoryName: z.string().nullable(),
  registeredAt: isoDateTimeStringSchema.nullable(),
  profileSnapshotAt: isoDateTimeStringSchema,
  draftWritable: z.literal(false),
});

export const previousSeasonProfileEmptySchema = z.strictObject({
  detailState: z.literal('EMPTY'),
  reason: previousSeasonProfileEmptyReasonSchema,
  message: z.string(),
});

export const previousSeasonProfileResponseSchema = z.discriminatedUnion('detailState', [
  previousSeasonProfileFullSchema,
  previousSeasonProfileEmptySchema,
]);

export type PreviousSeasonProfileEmptyReason = z.infer<
  typeof previousSeasonProfileEmptyReasonSchema
>;
export type PreviousSeasonProfileFull = z.infer<typeof previousSeasonProfileFullSchema>;
export type PreviousSeasonProfileEmpty = z.infer<typeof previousSeasonProfileEmptySchema>;
export type PreviousSeasonProfileResponse = z.infer<typeof previousSeasonProfileResponseSchema>;
