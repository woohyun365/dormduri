import { z } from 'zod';
import { campusSchema, type Campus } from '../identity/primitives.js';

export const collegeCodeSchema = z.enum([
  'CHUNCHEON_NURSING',
  'CHUNCHEON_BUSINESS',
  'CHUNCHEON_AGRICULTURE_LIFE',
  'CHUNCHEON_ANIMAL_LIFE',
  'CHUNCHEON_ARTS_ENGINEERING',
  'CHUNCHEON_EDUCATION',
  'CHUNCHEON_SOCIAL_SCIENCES',
  'CHUNCHEON_FOREST_ENVIRONMENT',
  'CHUNCHEON_VETERINARY_MEDICINE',
  'CHUNCHEON_PHARMACY',
  'CHUNCHEON_MEDICINE',
  'CHUNCHEON_BIOMEDICAL_SCIENCE',
  'CHUNCHEON_HUMANITIES',
  'CHUNCHEON_NATURAL_SCIENCES',
  'CHUNCHEON_IT',
  'CHUNCHEON_GLOBAL_FUTURE_CONVERGENCE',
  'SAMCHEOK_ENGINEERING',
  'SAMCHEOK_HUMANITIES_SOCIAL',
  'SAMCHEOK_DESIGN_SPORTS',
  'DOGYE_ENGINEERING',
  'DOGYE_HUMANITIES_SOCIAL',
  'DOGYE_HEALTH_SCIENCES',
  'DOGYE_OPEN_MAJOR',
]);

export const collegeCatalogItemSchema = z.strictObject({
  code: collegeCodeSchema,
  campusCode: campusSchema,
  nameKo: z.string(),
  sortOrder: z.number().int().nonnegative(),
  isActive: z.boolean(),
});

export type CampusCode = Campus;
export type CollegeCode = z.infer<typeof collegeCodeSchema>;
export type CollegeCatalogItem = z.infer<typeof collegeCatalogItemSchema>;
