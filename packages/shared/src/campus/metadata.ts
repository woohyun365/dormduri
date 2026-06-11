import { z } from 'zod';
import { campusSchema } from '../identity/primitives.js';

export const campusMetaSchema = z.strictObject({
  code: campusSchema,
  nameKo: z.string(),
  isOperated: z.boolean(),
});

export type CampusMeta = z.infer<typeof campusMetaSchema>;
