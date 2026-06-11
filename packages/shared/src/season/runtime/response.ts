import { z } from 'zod';
import { campusSchema } from '../../identity/primitives.js';
import {
  dormitorySeasonOperationSchema,
  seasonRuntimeOverrideSchema,
  seasonScheduleSchema,
  seasonStateSchema,
  seasonSummarySchema,
} from './primitives.js';

export const currentSeasonResponseSchema = z.strictObject({
  campusCode: campusSchema,
  season: seasonSummarySchema,
  operatedDormitories: z.array(dormitorySeasonOperationSchema),
  state: seasonStateSchema,
  isActive: z.boolean(),
  isOpen: z.boolean(),
  isMatching: z.boolean(),
  isPostMatch: z.boolean(),
  daysUntilMatchingEnd: z.number().int().nonnegative(),
  daysUntilSeasonEnd: z.number().int().nonnegative(),
  schedule: seasonScheduleSchema,
  override: seasonRuntimeOverrideSchema,
});

export type CurrentSeasonResponse = z.infer<typeof currentSeasonResponseSchema>;
