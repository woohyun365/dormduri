import { z } from 'zod';

export const genderSchema = z.enum(['M', 'F']);
export const campusSchema = z.enum(['CHUNCHEON', 'SAMCHEOK', 'DOGYE']);

export type Gender = z.infer<typeof genderSchema>;
export type Campus = z.infer<typeof campusSchema>;
