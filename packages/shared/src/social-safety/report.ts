import { z } from 'zod';
import { isoDateTimeStringSchema } from '../date-primitives.js';

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

export const createReportRequestSchema = z.strictObject({
  targetType: reportTargetTypeSchema,
  targetId: z.string().trim().min(1).max(128),
  reason: reportReasonSchema,
  detail: z.string().trim().max(2_000).optional().nullable(),
  evidenceAttachmentIds: z.array(z.string().trim().min(1).max(128)).max(10).optional().default([]),
  falseReportDisclaimerAccepted: z.literal(true),
});

export const reportReceiptSchema = z.strictObject({
  id: z.string().min(1),
  targetType: reportTargetTypeSchema,
  reason: reportReasonSchema,
  receivedAt: isoDateTimeStringSchema,
  status: z.enum(['RECEIVED', 'UNDER_REVIEW', 'RESOLVED']),
});

export const createReportResponseSchema = z.strictObject({
  report: reportReceiptSchema,
  received: z.boolean(),
});

export type ReportReason = z.infer<typeof reportReasonSchema>;
export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;
export type ReportRiskTier = z.infer<typeof reportRiskTierSchema>;
export type CreateReportRequest = z.infer<typeof createReportRequestSchema>;
export type ReportReceipt = z.infer<typeof reportReceiptSchema>;
export type CreateReportResponse = z.infer<typeof createReportResponseSchema>;
