import { z } from 'zod';
import { isoDateTimeStringSchema } from '../date/primitives.js';

export const noticeSeveritySchema = z.enum(['INFO', 'WARNING', 'CRITICAL', 'MAINTENANCE']);
export const NoticeSeverity = noticeSeveritySchema.enum;

export const globalNoticeIdSchema = z.string().trim().min(1).max(128);
const globalNoticeTitleSchema = z.string().trim().min(1).max(120);
const globalNoticeSummarySchema = z.string().trim().min(1).max(240);
const globalNoticeBodySchema = z.string().trim().min(1).max(10_000);
const globalNoticeCursorSchema = z.string().trim().min(1).max(512);

export const globalNoticePreviewSchema = z.strictObject({
  id: globalNoticeIdSchema,
  title: globalNoticeTitleSchema,
  summary: globalNoticeSummarySchema,
  severity: noticeSeveritySchema,
  publishedAt: isoDateTimeStringSchema,
  expiresAt: isoDateTimeStringSchema.nullable(),
  relatedSeasonId: z.string().min(1).nullable(),
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
});

export const globalNoticeSchema = globalNoticePreviewSchema.extend({
  body: globalNoticeBodySchema,
});

export const listGlobalNoticesQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(20).optional().default(3),
  cursor: globalNoticeCursorSchema.optional().nullable(),
  severity: noticeSeveritySchema.optional().nullable(),
  relatedSeasonId: z.string().trim().min(1).max(128).optional().nullable(),
});

export const globalNoticePageInfoSchema = z.strictObject({
  hasNextPage: z.boolean(),
  nextCursor: globalNoticeCursorSchema.nullable(),
});

export const globalNoticeListResponseSchema = z.strictObject({
  items: z.array(globalNoticePreviewSchema),
  pageInfo: globalNoticePageInfoSchema,
});

export const globalNoticeDetailResponseSchema = z.strictObject({
  notice: globalNoticeSchema,
});

export type NoticeSeverity = z.infer<typeof noticeSeveritySchema>;
export type GlobalNoticePreview = z.infer<typeof globalNoticePreviewSchema>;
export type GlobalNotice = z.infer<typeof globalNoticeSchema>;
export type ListGlobalNoticesQuery = z.infer<typeof listGlobalNoticesQuerySchema>;
export type GlobalNoticeListResponse = z.infer<typeof globalNoticeListResponseSchema>;
export type GlobalNoticeDetailResponse = z.infer<typeof globalNoticeDetailResponseSchema>;
