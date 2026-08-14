import { z } from 'zod';
import { isoDateTimeStringSchema } from '../../date/primitives.js';
import { seasonProfileDraftResponseSchema } from './profile-draft.js';

export const seasonProfileHistorySeasonIdSchema = z.string().trim().min(1).max(128);

export const seasonProfileHistoryEmptyReasonSchema = z.enum([
  'NO_PREVIOUS_SEASON_PROFILE',
  'SEASON_PROFILE_NOT_FOUND',
  'PROFILE_NOT_AVAILABLE',
]);

export const seasonProfileHistoryFullSchema = seasonProfileDraftResponseSchema.extend({
  detailState: z.literal('FULL'),
  seasonName: z.string(),
  dormitoryId: z.string().nullable(),
  dormitoryName: z.string().nullable(),
  registeredAt: isoDateTimeStringSchema.nullable(),
  profileSnapshotAt: isoDateTimeStringSchema,
  draftWritable: z.literal(false),
});

export const seasonProfileHistoryEmptySchema = z.strictObject({
  detailState: z.literal('EMPTY'),
  reason: seasonProfileHistoryEmptyReasonSchema,
  message: z.string(),
});

export const seasonProfileHistoryResponseSchema = z.discriminatedUnion('detailState', [
  seasonProfileHistoryFullSchema,
  seasonProfileHistoryEmptySchema,
]);

export const previousSeasonProfileEmptyReasonSchema = seasonProfileHistoryEmptyReasonSchema;
export const previousSeasonProfileFullSchema = seasonProfileHistoryFullSchema;
export const previousSeasonProfileEmptySchema = seasonProfileHistoryEmptySchema;
export const previousSeasonProfileResponseSchema = seasonProfileHistoryResponseSchema;

export type SeasonProfileHistoryEmptyReason = z.infer<typeof seasonProfileHistoryEmptyReasonSchema>;
export type SeasonProfileHistoryFull = z.infer<typeof seasonProfileHistoryFullSchema>;
export type SeasonProfileHistoryEmpty = z.infer<typeof seasonProfileHistoryEmptySchema>;
export type SeasonProfileHistoryResponse = z.infer<typeof seasonProfileHistoryResponseSchema>;

export type PreviousSeasonProfileEmptyReason = z.infer<
  typeof previousSeasonProfileEmptyReasonSchema
>;
export type PreviousSeasonProfileFull = z.infer<typeof previousSeasonProfileFullSchema>;
export type PreviousSeasonProfileEmpty = z.infer<typeof previousSeasonProfileEmptySchema>;
export type PreviousSeasonProfileResponse = z.infer<typeof previousSeasonProfileResponseSchema>;
