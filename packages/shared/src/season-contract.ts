import { z } from 'zod';
import { campusSchema } from './auth-contract.js';

const localDateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTimeStringSchema = z.iso.datetime({ offset: true });

export const seasonStateSchema = z.enum([
  'OFF_SEASON',
  'SEASON_PREPARATION',
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

export const currentSeasonResponseSchema = z.strictObject({
  campusCode: campusSchema,
  season: seasonSummarySchema,
  nextSeason: seasonSummarySchema.nullable(),
  operatedDormitories: z.array(dormitorySeasonOperationSchema),
  state: seasonStateSchema,
  isActive: z.boolean(),
  isPreparation: z.boolean(),
  isMatching: z.boolean(),
  isPostMatch: z.boolean(),
  daysUntilMatchingEnd: z.number().int().nonnegative(),
  daysUntilSeasonEnd: z.number().int().nonnegative(),
  schedule: seasonScheduleSchema,
  override: seasonRuntimeOverrideSchema,
});

export type SeasonState = z.infer<typeof seasonStateSchema>;
export type SeasonSummary = z.infer<typeof seasonSummarySchema>;
export type DormitorySeasonOperation = z.infer<typeof dormitorySeasonOperationSchema>;
export type SeasonSchedule = z.infer<typeof seasonScheduleSchema>;
export type SeasonRuntimeOverride = z.infer<typeof seasonRuntimeOverrideSchema>;
export type CurrentSeasonResponse = z.infer<typeof currentSeasonResponseSchema>;
