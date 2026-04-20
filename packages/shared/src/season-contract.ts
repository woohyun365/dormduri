import { z } from 'zod';

export const seasonStateSchema = z.enum(['OFF_SEASON', 'SEASON_OPEN', 'SEASON_MATCHING']);

export const seasonSummarySchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  roomSelectionDate: z.string(),
});

export const seasonScheduleSchema = z.strictObject({
  openStart: z.string(),
  matchStart: z.string(),
  matchEnd: z.string(),
});

export const currentSeasonResponseSchema = z.strictObject({
  season: seasonSummarySchema,
  nextSeason: seasonSummarySchema.nullable(),
  state: seasonStateSchema,
  isActive: z.boolean(),
  isOpen: z.boolean(),
  isMatching: z.boolean(),
  daysUntilEnd: z.number().int().nonnegative(),
  schedule: seasonScheduleSchema,
});

export type SeasonState = z.infer<typeof seasonStateSchema>;
export type SeasonSummary = z.infer<typeof seasonSummarySchema>;
export type SeasonSchedule = z.infer<typeof seasonScheduleSchema>;
export type CurrentSeasonResponse = z.infer<typeof currentSeasonResponseSchema>;
