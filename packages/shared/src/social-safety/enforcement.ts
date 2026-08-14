import { z } from 'zod';
import { isoDateTimeStringSchema } from '../date/primitives.js';

export const enforcementActionTypeSchema = z.enum([
  'WARNING',
  'MATCHING_RESTRICTION',
  'CHAT_RESTRICTION',
  'ACCOUNT_RESTRICTION',
  'CONTENT_VISIBILITY_RESTRICTION',
]);
export const EnforcementActionType = enforcementActionTypeSchema.enum;

export const enforcementReasonCategorySchema = z.enum([
  'SEXUAL_HARASSMENT',
  'THREAT',
  'PERSONAL_INFO_EXPOSURE',
  'GENDER_IMPERSONATION',
  'FALSE_PROFILE',
  'SPAM_OR_AD',
  'HATE_OR_DISCRIMINATION',
  'POLICY_VIOLATION',
  'SAFETY_REVIEW',
  'ADMIN_ACTION',
  'OTHER',
]);
export const EnforcementReasonCategory = enforcementReasonCategorySchema.enum;

export const enforcementNoticeStatusSchema = z.enum(['ACTIVE', 'ENDED']);
export const EnforcementNoticeStatus = enforcementNoticeStatusSchema.enum;

const enforcementCursorSchema = z.string().trim().min(1).max(512);

export const listEnforcementNoticesQuerySchema = z.strictObject({
  cursor: enforcementCursorSchema.optional().nullable(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const enforcementNoticeSchema = z.strictObject({
  id: z.string().trim().min(1).max(160),
  actionType: enforcementActionTypeSchema,
  reasonCategory: enforcementReasonCategorySchema,
  status: enforcementNoticeStatusSchema,
  seasonLabel: z.string().trim().min(1).max(80).nullable(),
  scopeLabel: z.string().trim().min(1).max(120),
  policyBasisSummary: z.string().trim().min(1).max(240),
  effectiveFrom: isoDateTimeStringSchema,
  effectiveUntil: isoDateTimeStringSchema.nullable(),
  createdAt: isoDateTimeStringSchema,
});

export const enforcementNoticeListResponseSchema = z.strictObject({
  items: z.array(enforcementNoticeSchema),
  pageInfo: z.strictObject({
    hasNextPage: z.boolean(),
    nextCursor: enforcementCursorSchema.nullable(),
  }),
});

export type EnforcementActionType = z.infer<typeof enforcementActionTypeSchema>;
export type EnforcementReasonCategory = z.infer<typeof enforcementReasonCategorySchema>;
export type EnforcementNoticeStatus = z.infer<typeof enforcementNoticeStatusSchema>;
export type ListEnforcementNoticesQuery = z.infer<typeof listEnforcementNoticesQuerySchema>;
export type EnforcementNotice = z.infer<typeof enforcementNoticeSchema>;
export type EnforcementNoticeListResponse = z.infer<typeof enforcementNoticeListResponseSchema>;
