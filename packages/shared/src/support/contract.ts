import { z } from 'zod';
import { isoDateTimeStringSchema } from '../date-primitives.js';

export const supportTicketCategorySchema = z.enum([
  'ACCOUNT',
  'SEASON',
  'MATCHING',
  'REPORT_OR_BLOCK',
  'APPEAL',
  'BUG',
  'OTHER',
]);
export const SupportTicketCategory = supportTicketCategorySchema.enum;

export const supportTicketStatusSchema = z.enum([
  'OPEN',
  'WAITING_USER',
  'WAITING_OPERATOR',
  'RESOLVED',
  'CLOSED',
]);
export const SupportTicketStatus = supportTicketStatusSchema.enum;

export const supportAppealCategorySchema = z.enum([
  'SANCTION',
  'TEMPORARY_RESTRICTION',
  'REPORT_RESULT',
  'CONTENT_ACTION',
]);
export const SupportAppealCategory = supportAppealCategorySchema.enum;

export const createSupportTicketRequestSchema = z.strictObject({
  category: supportTicketCategorySchema,
  subject: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(4_000),
  relatedEntityId: z.string().trim().min(1).max(128).optional().nullable(),
  appealCategory: supportAppealCategorySchema.optional().nullable(),
  emailReplyConsent: z.boolean().optional().default(false),
});

export const supportTicketResponseSchema = z.strictObject({
  id: z.string().min(1),
  category: supportTicketCategorySchema,
  subject: z.string().min(1),
  status: supportTicketStatusSchema,
  emailReplyConsent: z.boolean(),
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
});

export const supportFaqItemSchema = z.strictObject({
  id: z.string().min(1),
  category: supportTicketCategorySchema,
  question: z.string().min(1),
  answer: z.string().min(1),
  published: z.boolean(),
  updatedAt: isoDateTimeStringSchema,
});

export type SupportTicketCategory = z.infer<typeof supportTicketCategorySchema>;
export type CreateSupportTicketRequest = z.infer<typeof createSupportTicketRequestSchema>;
export type SupportTicketResponse = z.infer<typeof supportTicketResponseSchema>;
export type SupportTicketStatus = z.infer<typeof supportTicketStatusSchema>;
export type SupportFaqItem = z.infer<typeof supportFaqItemSchema>;
export type SupportAppealCategory = z.infer<typeof supportAppealCategorySchema>;
