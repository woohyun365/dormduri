import { z } from 'zod';
import { isoDateTimeStringSchema, localDateStringSchema } from '../date-primitives.js';

export const seasonStateSchema = z.enum([
  'OFF_SEASON',
  'SEASON_OPEN',
  'SEASON_MATCHING',
  'SEASON_POST_MATCH',
]);

export const seasonSummarySchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  preparationStartDate: localDateStringSchema,
  matchingStartDate: localDateStringSchema,
  seasonEndDate: localDateStringSchema,
});

export const dormitorySeasonOperationSchema = z.strictObject({
  dormitoryId: z.string(),
  isOperated: z.boolean(),
  roomSelectionDate: localDateStringSchema,
});

export const seasonScheduleSchema = z.strictObject({
  preparationStart: localDateStringSchema,
  matchingStart: localDateStringSchema,
  matchingEnd: localDateStringSchema,
  seasonEnd: localDateStringSchema,
});

export const seasonRuntimeOverrideSchema = z.strictObject({
  active: z.boolean(),
  state: seasonStateSchema.nullable(),
  reason: z.string().nullable(),
  startedAt: isoDateTimeStringSchema.nullable(),
  endsAt: isoDateTimeStringSchema.nullable(),
});

export type SeasonState = z.infer<typeof seasonStateSchema>;
export type SeasonSummary = z.infer<typeof seasonSummarySchema>;
export type DormitorySeasonOperation = z.infer<typeof dormitorySeasonOperationSchema>;
export type SeasonSchedule = z.infer<typeof seasonScheduleSchema>;
export type SeasonRuntimeOverride = z.infer<typeof seasonRuntimeOverrideSchema>;
