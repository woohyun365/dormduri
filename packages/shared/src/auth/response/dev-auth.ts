import { z } from 'zod';
import { campusSchema, genderSchema } from '../../identity/primitives.js';
import { genericErrorResponseSchema } from './base.js';

export const devAuthPresetUserSummarySchema = z.strictObject({
  presetKey: z.string(),
  email: z.string().email(),
  nickname: z.string(),
  gender: genderSchema,
  campus: campusSchema,
  loginPassword: z.string(),
});

export const devAuthPresetGroupSchema = z.strictObject({
  campus: campusSchema,
  label: z.string(),
  users: z.array(devAuthPresetUserSummarySchema),
});

export const devAuthUserSummarySchema = z.strictObject({
  id: z.string().optional(),
  email: z.string().email(),
  nickname: z.string(),
  gender: genderSchema,
  campus: campusSchema.optional(),
});

export const devAuthUsersResponseSchema = genericErrorResponseSchema.extend({
  presetGroups: z.array(devAuthPresetGroupSchema).optional(),
  users: z.array(devAuthUserSummarySchema).optional(),
});

export type DevAuthPresetUserSummary = z.infer<typeof devAuthPresetUserSummarySchema>;
export type DevAuthPresetGroup = z.infer<typeof devAuthPresetGroupSchema>;
export type DevAuthUserSummary = z.infer<typeof devAuthUserSummarySchema>;
export type DevAuthUsersResponse = z.infer<typeof devAuthUsersResponseSchema>;
