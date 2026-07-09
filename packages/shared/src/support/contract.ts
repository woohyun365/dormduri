import { z } from 'zod';
import { isoDateTimeStringSchema } from '../date/primitives.js';

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

export const supportFaqSurfaceSchema = z.enum(['LANDING', 'SUPPORT_CENTER']);
export const SupportFaqSurface = supportFaqSurfaceSchema.enum;

export const supportMessageSenderTypeSchema = z.enum(['USER', 'OPERATOR', 'SYSTEM']);
export const SupportMessageSenderType = supportMessageSenderTypeSchema.enum;

const supportSubjectSchema = z.string().trim().min(1).max(120);
const supportMessageBodySchema = z.string().trim().min(1).max(4_000);
const supportTicketIdSchema = z.string().trim().min(1).max(128);
const supportCursorSchema = z.string().trim().min(1).max(512);

function requireAppealCategoryForAppeal(
  value: {
    category: SupportTicketCategory;
    appealCategory?: SupportAppealCategory | null;
    relatedEntityId?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (value.category === SupportTicketCategory.APPEAL && !value.appealCategory) {
    ctx.addIssue({
      code: 'custom',
      path: ['appealCategory'],
      message: 'appealCategory is required when category is APPEAL',
    });
  }

  if (
    value.category === SupportTicketCategory.APPEAL &&
    value.appealCategory === SupportAppealCategory.REPORT_RESULT &&
    !value.relatedEntityId
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['relatedEntityId'],
      message: 'relatedEntityId is required when appealCategory is REPORT_RESULT',
    });
  }
}

export const createSupportTicketRequestSchema = z
  .strictObject({
    category: supportTicketCategorySchema,
    subject: supportSubjectSchema,
    body: supportMessageBodySchema,
    relatedEntityId: supportTicketIdSchema.optional().nullable(),
    appealCategory: supportAppealCategorySchema.optional().nullable(),
    emailReplyConsent: z.boolean().optional().default(false),
  })
  .superRefine(requireAppealCategoryForAppeal);

export const appendSupportTicketMessageRequestSchema = z.strictObject({
  body: supportMessageBodySchema,
});

export const replySupportTicketRequestSchema = z.strictObject({
  body: supportMessageBodySchema,
  status: z.enum(['WAITING_USER', 'RESOLVED', 'CLOSED']).optional().default('WAITING_USER'),
});

export const resolveSupportTicketRequestSchema = z.strictObject({
  status: z.enum(['RESOLVED', 'CLOSED']).optional().default('RESOLVED'),
});

export const listSupportTicketsQuerySchema = z.strictObject({
  status: supportTicketStatusSchema.optional().nullable(),
  category: supportTicketCategorySchema.optional().nullable(),
  cursor: supportCursorSchema.optional().nullable(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const listSupportFaqQuerySchema = z.strictObject({
  category: supportTicketCategorySchema.optional().nullable(),
  surface: supportFaqSurfaceSchema.optional().nullable(),
});

export const supportTicketMessageSchema = z.strictObject({
  id: z.string().min(1),
  ticketId: z.string().min(1),
  senderType: supportMessageSenderTypeSchema,
  createdAt: isoDateTimeStringSchema,
  body: z.string().min(1),
});

export const supportTicketResponseSchema = z.strictObject({
  id: z.string().min(1),
  category: supportTicketCategorySchema,
  subject: z.string().min(1),
  status: supportTicketStatusSchema,
  relatedEntityId: z.string().min(1).nullable(),
  appealCategory: supportAppealCategorySchema.nullable(),
  emailReplyConsent: z.boolean(),
  lastMessageAt: isoDateTimeStringSchema,
  closedAt: isoDateTimeStringSchema.nullable(),
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
});

export const supportTicketPageInfoSchema = z.strictObject({
  hasNextPage: z.boolean(),
  nextCursor: z.string().min(1).nullable(),
});

export const supportTicketListResponseSchema = z.strictObject({
  items: z.array(supportTicketResponseSchema),
  pageInfo: supportTicketPageInfoSchema,
});

export const supportTicketDetailResponseSchema = z.strictObject({
  ticket: supportTicketResponseSchema,
  messages: z.array(supportTicketMessageSchema),
});

export const createSupportTicketResponseSchema = z.strictObject({
  ticket: supportTicketResponseSchema,
});

export const appendSupportTicketMessageResponseSchema = z.strictObject({
  ticket: supportTicketResponseSchema,
  message: supportTicketMessageSchema,
});

export const replySupportTicketResponseSchema = appendSupportTicketMessageResponseSchema;

export const resolveSupportTicketResponseSchema = z.strictObject({
  ticket: supportTicketResponseSchema,
});

export const supportFaqItemSchema = z.strictObject({
  id: z.string().min(1),
  category: supportTicketCategorySchema,
  question: z.string().min(1),
  answer: z.string().min(1),
  published: z.boolean(),
  sortOrder: z.number().int(),
  updatedAt: isoDateTimeStringSchema,
});

export const supportFaqListResponseSchema = z.strictObject({
  items: z.array(supportFaqItemSchema),
});

export const supportFaqDetailResponseSchema = z.strictObject({
  item: supportFaqItemSchema,
});

export type SupportTicketCategory = z.infer<typeof supportTicketCategorySchema>;
export type CreateSupportTicketRequest = z.infer<typeof createSupportTicketRequestSchema>;
export type AppendSupportTicketMessageRequest = z.infer<
  typeof appendSupportTicketMessageRequestSchema
>;
export type ReplySupportTicketRequest = z.infer<typeof replySupportTicketRequestSchema>;
export type ResolveSupportTicketRequest = z.infer<typeof resolveSupportTicketRequestSchema>;
export type ListSupportTicketsQuery = z.infer<typeof listSupportTicketsQuerySchema>;
export type ListSupportFaqQuery = z.infer<typeof listSupportFaqQuerySchema>;
export type SupportTicketResponse = z.infer<typeof supportTicketResponseSchema>;
export type SupportTicketDetailResponse = z.infer<typeof supportTicketDetailResponseSchema>;
export type SupportTicketListResponse = z.infer<typeof supportTicketListResponseSchema>;
export type CreateSupportTicketResponse = z.infer<typeof createSupportTicketResponseSchema>;
export type AppendSupportTicketMessageResponse = z.infer<
  typeof appendSupportTicketMessageResponseSchema
>;
export type ReplySupportTicketResponse = z.infer<typeof replySupportTicketResponseSchema>;
export type ResolveSupportTicketResponse = z.infer<typeof resolveSupportTicketResponseSchema>;
export type SupportTicketStatus = z.infer<typeof supportTicketStatusSchema>;
export type SupportFaqSurface = z.infer<typeof supportFaqSurfaceSchema>;
export type SupportFaqItem = z.infer<typeof supportFaqItemSchema>;
export type SupportFaqListResponse = z.infer<typeof supportFaqListResponseSchema>;
export type SupportFaqDetailResponse = z.infer<typeof supportFaqDetailResponseSchema>;
export type SupportAppealCategory = z.infer<typeof supportAppealCategorySchema>;
export type SupportMessageSenderType = z.infer<typeof supportMessageSenderTypeSchema>;
