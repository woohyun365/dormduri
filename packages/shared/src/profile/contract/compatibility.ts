import { z } from 'zod';

export const publicProfileCompatibilityAxisIdSchema = z.enum([
  'SMOKING',
  'SLEEP_HABIT',
  'PHONE',
  'EARPHONE',
  'SLEEP_ENVIRONMENT',
  'SCREEN_USAGE',
  'CLEAN_LEVEL',
  'INDOOR_EATING',
  'BEDTIME',
  'WAKE_TIME',
  'TEMPERATURE',
  'RELATIONSHIP',
]);

export const publicProfileCompatibilityBucketSchema = z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']);

export const publicProfileCompatibilityHiddenNoticeCodeSchema = z.enum([
  'DRINKING_EXCLUDED_BY_POLICY',
]);

export const publicProfileCompatibilityAxisSchema = z.strictObject({
  id: publicProfileCompatibilityAxisIdSchema,
  score: z.number().int().min(0).max(100).nullable(),
  bucket: publicProfileCompatibilityBucketSchema,
});

export const publicProfileCompatibilityHiddenNoticeSchema = z.strictObject({
  code: publicProfileCompatibilityHiddenNoticeCodeSchema,
});

export const publicProfileCompatibilitySchema = z.strictObject({
  overallScore: z.number().int().min(0).max(100),
  axes: z.array(publicProfileCompatibilityAxisSchema),
  hiddenAxisNotices: z.array(publicProfileCompatibilityHiddenNoticeSchema),
});

export type PublicProfileCompatibilityAxisId = z.infer<
  typeof publicProfileCompatibilityAxisIdSchema
>;
export type PublicProfileCompatibilityBucket = z.infer<
  typeof publicProfileCompatibilityBucketSchema
>;
export type PublicProfileCompatibilityHiddenNoticeCode = z.infer<
  typeof publicProfileCompatibilityHiddenNoticeCodeSchema
>;
export type PublicProfileCompatibilityAxis = z.infer<typeof publicProfileCompatibilityAxisSchema>;
export type PublicProfileCompatibilityHiddenNotice = z.infer<
  typeof publicProfileCompatibilityHiddenNoticeSchema
>;
export type PublicProfileCompatibility = z.infer<typeof publicProfileCompatibilitySchema>;
