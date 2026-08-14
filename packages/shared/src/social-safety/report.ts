import { z } from 'zod';
import { isoDateTimeStringSchema } from '../date/primitives.js';

export const REPORT_DETAIL_MAX_LENGTH = 2_000;

export const reportReasonSchema = z.enum([
  'SEXUAL_HARASSMENT',
  'THREAT',
  'PERSONAL_INFO_EXPOSURE',
  'GENDER_IMPERSONATION',
  'FALSE_PROFILE',
  'SPAM_OR_AD',
  'HATE_OR_DISCRIMINATION',
  'OTHER',
]);

export const reportTargetTypeSchema = z.enum([
  'PROFILE',
  'MATCH_REQUEST',
  'CHAT_THREAD',
  'CHAT_MESSAGE',
  'SUPPORT_TICKET',
]);

export const reportRiskTierSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const reportOptionalActionSchema = z.enum(['BLOCK_TARGET']);
export const reportOptionalActionResultStatusSchema = z.enum(['SUCCEEDED', 'FAILED', 'SKIPPED']);

export const createReportRequestSchema = z.strictObject({
  targetType: reportTargetTypeSchema,
  targetId: z.string().trim().min(1).max(128),
  reason: reportReasonSchema,
  detail: z.string().trim().max(REPORT_DETAIL_MAX_LENGTH).optional().nullable(),
  evidenceAttachmentIds: z.array(z.string().trim().min(1).max(128)).max(10).optional().default([]),
  optionalAction: reportOptionalActionSchema.optional().nullable(),
  falseReportDisclaimerAccepted: z.literal(true),
});

export const reportOptionalActionResultSchema = z.strictObject({
  action: reportOptionalActionSchema,
  status: reportOptionalActionResultStatusSchema,
  code: z.string().trim().min(1).max(128).optional().nullable(),
});

export const reportReceiptSchema = z.strictObject({
  id: z.string().min(1),
  targetType: reportTargetTypeSchema,
  reason: reportReasonSchema,
  receivedAt: isoDateTimeStringSchema,
  status: z.literal('RECEIVED'),
});

export const createReportResponseSchema = z.strictObject({
  report: reportReceiptSchema,
  received: z.boolean(),
  optionalActionResult: reportOptionalActionResultSchema.optional().nullable(),
});

const reportListCursorSchema = z.string().trim().min(1).max(512);

export const listReportsQuerySchema = z.strictObject({
  cursor: reportListCursorSchema.optional().nullable(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const reportListItemSchema = z.strictObject({
  id: z.string().min(1),
  targetType: reportTargetTypeSchema,
  targetLabel: z.string().trim().min(1).max(80),
  reason: reportReasonSchema,
  receivedAt: isoDateTimeStringSchema,
  status: z.literal('RECEIVED'),
});

export const reportListResponseSchema = z.strictObject({
  items: z.array(reportListItemSchema),
  pageInfo: z.strictObject({
    hasNextPage: z.boolean(),
    nextCursor: reportListCursorSchema.nullable(),
  }),
});

export type ReportReason = z.infer<typeof reportReasonSchema>;
export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;
export type ReportRiskTier = z.infer<typeof reportRiskTierSchema>;
export type ReportOptionalAction = z.infer<typeof reportOptionalActionSchema>;
export type ReportOptionalActionResultStatus = z.infer<
  typeof reportOptionalActionResultStatusSchema
>;
export type CreateReportRequest = z.infer<typeof createReportRequestSchema>;
export type ReportOptionalActionResult = z.infer<typeof reportOptionalActionResultSchema>;
export type ReportReceipt = z.infer<typeof reportReceiptSchema>;
export type CreateReportResponse = z.infer<typeof createReportResponseSchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
export type ReportListItem = z.infer<typeof reportListItemSchema>;
export type ReportListResponse = z.infer<typeof reportListResponseSchema>;
