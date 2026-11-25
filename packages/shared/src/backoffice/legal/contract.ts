import { z } from 'zod';
import {
  legalArticleComparisonSchema,
  legalDocumentDraftImportSchema,
  legalDocumentKindSchema,
  legalDocumentSectionSchema,
  legalNoticeClassSchema,
  legalVersionKeySchema,
} from '../../legal/contract.js';
import {
  accessRequestApproveRequestSchema,
  accessRequestRejectRequestSchema,
  accessRequestStatusSchema,
} from '../contract.js';

/**
 * Backoffice legal API: drafts, publish and withdraw requests and
 * their decisions. A draft body is the shared import schema, so the editor and a JSON file pass the
 * same checks; the BFF parses every response with these schemas.
 */
const idSchema = z.uuid();
const reasonSchema = z.string().trim().min(1).max(500);
const isoDateTimeSchema = z.iso.datetime({ offset: true });
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const revisionSchema = z.number().int().min(1);

export const legalDraftSourceSchema = z.enum(['editor', 'import']);
export const legalDraftStatusSchema = z.enum([
  'EDITING',
  'PENDING_APPROVAL',
  'PUBLISHED',
  'DISCARDED',
]);
export const legalRequestKindSchema = z.enum(['LEGAL_PUBLISH', 'LEGAL_WITHDRAW']);

export const legalDraftCreateRequestSchema = z.strictObject({
  source: legalDraftSourceSchema,
  draft: legalDocumentDraftImportSchema,
});
/** Saves at the revision the editor read; a draft of another kind is a new draft. */
export const legalDraftUpdateRequestSchema = z.strictObject({
  revision: revisionSchema,
  draft: legalDocumentDraftImportSchema,
});
export const legalDraftDiscardRequestSchema = z.strictObject({ revision: revisionSchema });
/** The request digest is the draft content at this revision. */
export const legalPublishRequestCreateSchema = z.strictObject({
  revision: revisionSchema,
  reason: reasonSchema.optional(),
});
export const legalWithdrawRequestCreateSchema = z.strictObject({ reason: reasonSchema.optional() });
// Approve and reject read like the role requests: the digest the approver saw, a reason for the
// single-approver exception, and always a reason for a rejection (OA-R9).
export const legalRequestApproveRequestSchema = accessRequestApproveRequestSchema;
export const legalRequestRejectRequestSchema = accessRequestRejectRequestSchema;

const pageQueryShape = {
  beforeTime: z.iso.datetime({ offset: true }).optional(),
  beforeId: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
};
const cursorComplete = (query: { beforeTime?: string; beforeId?: string }) =>
  (query.beforeTime === undefined) === (query.beforeId === undefined);
const cursorMessage = { message: 'beforeTime and beforeId go together' };

export const legalDraftListQuerySchema = z
  .strictObject({
    kind: legalDocumentKindSchema.optional(),
    status: legalDraftStatusSchema.optional(),
    ...pageQueryShape,
  })
  .refine(cursorComplete, cursorMessage);
export const legalRequestListQuerySchema = z
  .strictObject({
    kind: legalRequestKindSchema.optional(),
    status: accessRequestStatusSchema.optional(),
    ...pageQueryShape,
  })
  .refine(cursorComplete, cursorMessage);

const pageCursorSchema = z.object({ beforeTime: isoDateTimeSchema, beforeId: idSchema });

/** Draft content as stored: the parsed import body, with `appliesUntil` null outside a historical record. */
export const legalDraftContentSchema = z.object({
  kind: legalDocumentKindSchema,
  contentSchemaVersion: z.number().int(),
  title: z.string(),
  summaryItems: z.array(z.string()),
  sections: z.array(legalDocumentSectionSchema),
  changeSummary: z.string(),
  noticeClass: legalNoticeClassSchema,
  consentRequired: z.boolean(),
  proposedEffectiveDate: legalVersionKeySchema,
  appliesUntil: legalVersionKeySchema.nullable(),
});

export const legalDraftSchema = z.object({
  id: idSchema,
  kind: legalDocumentKindSchema,
  status: legalDraftStatusSchema,
  revision: revisionSchema,
  basedOnVersionId: z.string().nullable(),
  authorAccountId: idSchema,
  content: legalDraftContentSchema,
  contentDigest: digestSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const legalVersionStateSchema = z.enum(['scheduled', 'current', 'previous', 'withdrawn']);

export const legalBackofficeVersionSchema = z.object({
  id: z.string(),
  kind: legalDocumentKindSchema,
  version: z.string(),
  title: z.string(),
  changeSummary: z.string(),
  noticeClass: legalNoticeClassSchema,
  consentRequired: z.boolean(),
  effectiveDate: legalVersionKeySchema,
  appliesUntil: legalVersionKeySchema.nullable(),
  contentDigest: digestSchema,
  publishedAt: isoDateTimeSchema,
  withdrawnAt: isoDateTimeSchema.nullable(),
  requestedByAccountId: idSchema.nullable(),
  approvedByAccountId: idSchema.nullable(),
  selfApproved: z.boolean(),
});
export const legalBackofficeVersionDetailSchema = legalBackofficeVersionSchema.extend({
  contentSchemaVersion: z.number().int(),
  summaryItems: z.array(z.string()),
  sections: z.array(legalDocumentSectionSchema),
});

export const legalRequestSchema = z.object({
  id: idSchema,
  kind: legalRequestKindSchema,
  status: accessRequestStatusSchema,
  contentDigest: digestSchema,
  targetLegalDraftId: idSchema.nullable(),
  targetLegalVersionId: z.string().nullable(),
  requestedByAccountId: idSchema,
  requestReason: z.string().nullable(),
  expiresAt: isoDateTimeSchema,
  decidedByAccountId: idSchema.nullable(),
  closedAt: isoDateTimeSchema.nullable(),
  decisionReason: z.string().nullable(),
  selfApproved: z.boolean(),
  createdAt: isoDateTimeSchema,
});

export const legalPublicationRefusalSchema = z.enum([
  'first_publication_exists',
  'first_publication_required',
  'historical_not_before_approval',
  'historical_overlap',
  'initial_after_approval',
  'initial_not_after_history',
  'notice_too_short',
  'scheduled_version_exists',
  'effective_date_taken',
  'members_exist',
]);
export const legalWithdrawalRefusalSchema = z.enum([
  'not_withdrawable',
  'already_withdrawn',
  'already_in_effect',
]);
/** The decision checks run now on the database clock; the decision runs them again. */
export const legalDecisionCheckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({
    ok: z.literal(false),
    reason: z.union([legalPublicationRefusalSchema, legalWithdrawalRefusalSchema]),
  }),
]);

export const legalDocumentsOverviewResponseSchema = z.object({
  documents: z.array(
    z.object({
      kind: legalDocumentKindSchema,
      versions: z.array(legalBackofficeVersionSchema.extend({ state: legalVersionStateSchema })),
    }),
  ),
});
export const legalDraftListResponseSchema = z.object({
  drafts: z.array(legalDraftSchema),
  nextPage: pageCursorSchema.nullable(),
});
/** Preview data: the draft, the version before it and the article comparison. */
export const legalDraftDetailResponseSchema = z.object({
  draft: legalDraftSchema,
  previousVersion: legalBackofficeVersionSchema.nullable(),
  comparison: z.array(legalArticleComparisonSchema),
});
export const legalRequestListResponseSchema = z.object({
  requests: z.array(legalRequestSchema),
  nextPage: pageCursorSchema.nullable(),
});
/**
 * Approval screen data: what the request names, the comparison and, while the request can still be
 * decided, the checks as of now (`null` for a closed request, whose target is shown as it is now).
 */
export const legalRequestDetailResponseSchema = z.object({
  request: legalRequestSchema,
  draft: legalDraftSchema.nullable(),
  version: legalBackofficeVersionDetailSchema.nullable(),
  previousVersion: legalBackofficeVersionSchema.nullable(),
  comparison: z.array(legalArticleComparisonSchema),
  check: legalDecisionCheckSchema.nullable(),
});
export const legalDecisionResponseSchema = z.object({
  request: legalRequestSchema,
  version: legalBackofficeVersionSchema.nullable(),
});

export type LegalDraftSource = z.infer<typeof legalDraftSourceSchema>;
export type LegalDraftStatus = z.infer<typeof legalDraftStatusSchema>;
export type LegalRequestKind = z.infer<typeof legalRequestKindSchema>;
export type LegalDraftCreateRequest = z.infer<typeof legalDraftCreateRequestSchema>;
export type LegalDraftUpdateRequest = z.infer<typeof legalDraftUpdateRequestSchema>;
export type LegalDraftDiscardRequest = z.infer<typeof legalDraftDiscardRequestSchema>;
export type LegalPublishRequestCreate = z.infer<typeof legalPublishRequestCreateSchema>;
export type LegalWithdrawRequestCreate = z.infer<typeof legalWithdrawRequestCreateSchema>;
export type LegalRequestApproveRequest = z.infer<typeof legalRequestApproveRequestSchema>;
export type LegalRequestRejectRequest = z.infer<typeof legalRequestRejectRequestSchema>;
export type LegalDraftListQuery = z.infer<typeof legalDraftListQuerySchema>;
export type LegalRequestListQuery = z.infer<typeof legalRequestListQuerySchema>;
export type LegalDraftContent = z.infer<typeof legalDraftContentSchema>;
export type LegalDraft = z.infer<typeof legalDraftSchema>;
export type LegalVersionState = z.infer<typeof legalVersionStateSchema>;
export type LegalBackofficeVersion = z.infer<typeof legalBackofficeVersionSchema>;
export type LegalBackofficeVersionDetail = z.infer<typeof legalBackofficeVersionDetailSchema>;
export type LegalRequest = z.infer<typeof legalRequestSchema>;
export type LegalPublicationRefusal = z.infer<typeof legalPublicationRefusalSchema>;
export type LegalWithdrawalRefusal = z.infer<typeof legalWithdrawalRefusalSchema>;
export type LegalDecisionCheck = z.infer<typeof legalDecisionCheckSchema>;
