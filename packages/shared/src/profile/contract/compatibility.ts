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

export const publicProfileCompatibilityDimensionIdSchema = z.enum([
  'SMOKING',
  'SLEEP_RHYTHM',
  'SLEEP_HABIT',
  'SLEEP_ENVIRONMENT',
  'DEVICE_USAGE',
  'CLEAN_SPACE',
  'TEMPERATURE',
  'RELATIONSHIP_STYLE',
]);

export const publicProfileCompatibilityHiddenNoticeCodeSchema = z.enum([
  'DRINKING_EXCLUDED_BY_POLICY',
]);

export const publicProfileCompatibilityAxisComparisonSchema = z.strictObject({
  targetText: z.string().min(1).max(80),
  viewerText: z.string().min(1).max(80),
});

export const publicProfileCompatibilityAxisSchema = z.strictObject({
  id: publicProfileCompatibilityAxisIdSchema,
  score: z.number().int().min(0).max(100).nullable(),
  bucket: publicProfileCompatibilityBucketSchema,
  comparison: publicProfileCompatibilityAxisComparisonSchema,
});

export const publicProfileCompatibilityDimensionSchema = z.strictObject({
  id: publicProfileCompatibilityDimensionIdSchema,
  score: z.number().int().min(0).max(100).nullable(),
  bucket: publicProfileCompatibilityBucketSchema,
  axisIds: z.array(publicProfileCompatibilityAxisIdSchema).min(1),
});

export const publicProfileCompatibilityHiddenNoticeSchema = z.strictObject({
  code: publicProfileCompatibilityHiddenNoticeCodeSchema,
});

export const publicProfileCompatibilitySchema = z.strictObject({
  overallScore: z.number().int().min(0).max(100),
  dimensions: z.array(publicProfileCompatibilityDimensionSchema),
  axes: z.array(publicProfileCompatibilityAxisSchema),
  hiddenAxisNotices: z.array(publicProfileCompatibilityHiddenNoticeSchema),
});

export type PublicProfileCompatibilityAxisId = z.infer<
  typeof publicProfileCompatibilityAxisIdSchema
>;
export type PublicProfileCompatibilityBucket = z.infer<
  typeof publicProfileCompatibilityBucketSchema
>;
export type PublicProfileCompatibilityDimensionId = z.infer<
  typeof publicProfileCompatibilityDimensionIdSchema
>;
export type PublicProfileCompatibilityHiddenNoticeCode = z.infer<
  typeof publicProfileCompatibilityHiddenNoticeCodeSchema
>;
export type PublicProfileCompatibilityAxis = z.infer<typeof publicProfileCompatibilityAxisSchema>;
export type PublicProfileCompatibilityAxisComparison = z.infer<
  typeof publicProfileCompatibilityAxisComparisonSchema
>;
export type PublicProfileCompatibilityDimension = z.infer<
  typeof publicProfileCompatibilityDimensionSchema
>;
export type PublicProfileCompatibilityHiddenNotice = z.infer<
  typeof publicProfileCompatibilityHiddenNoticeSchema
>;
export type PublicProfileCompatibility = z.infer<typeof publicProfileCompatibilitySchema>;
