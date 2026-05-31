import { z } from 'zod';
import { campusSchema, type Campus } from './identity-contract.js';

export const collegeCodeSchema = z.enum([
  'IT',
  'NURSING',
  'BUSINESS',
  'AGRICULTURE_LIFE',
  'ANIMAL_LIFE',
  'ARTS_ENGINEERING',
  'EDUCATION',
  'SOCIAL_SCIENCES',
  'FOREST_ENVIRONMENT',
  'MEDICINE_PHARMACY_VETERINARY',
  'BIOMEDICAL_SCIENCE',
  'HUMANITIES',
  'NATURAL_SCIENCES',
  'OPEN_MAJOR',
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
