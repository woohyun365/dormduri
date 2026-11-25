import { z } from 'zod';
import { isoDateTimeStringSchema } from '../date/primitives.js';

export const legalDocumentKindSchema = z.enum([
  'TERMS_OF_SERVICE',
  'PRIVACY_POLICY',
  'PERSONAL_DATA_COLLECTION_USE_CONSENT',
  'AGE_14_OR_ABOVE_NOTICE',
]);
export const LegalDocumentKind = legalDocumentKindSchema.enum;

export const legalAcceptanceActionSchema = z.enum(['AGREE', 'SHOW']);
export const LegalAcceptanceAction = legalAcceptanceActionSchema.enum;

export const legalDocumentVersionIdSchema = z.string().trim().min(1).max(128);

const legalDocumentTextSchema = z.string().trim().min(1).max(8_000);
const legalDocumentTitleSchema = z.string().trim().min(1).max(160);
const legalDocumentSummaryItemSchema = z.string().trim().min(1).max(240);

const legalDocumentHeadingSectionSchema = z.strictObject({
  type: z.literal('heading'),
  level: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2),
  text: legalDocumentTitleSchema,
});

const legalDocumentParagraphSectionSchema = z.strictObject({
  type: z.literal('paragraph'),
  text: legalDocumentTextSchema,
});

const legalDocumentListSectionSchema = z.strictObject({
  type: z.literal('list'),
  ordered: z.boolean().optional().default(false),
  items: z.array(legalDocumentTextSchema).min(1),
});

const legalDocumentTableSectionSchema = z.strictObject({
  type: z.literal('table'),
  caption: legalDocumentTitleSchema.optional(),
  headers: z.array(legalDocumentTitleSchema).min(1).max(8),
  rows: z.array(z.array(legalDocumentTextSchema).min(1).max(8)).min(1),
});

const legalDocumentCalloutSectionSchema = z.strictObject({
  type: z.literal('callout'),
  tone: z.enum(['INFO', 'WARNING']).default('INFO'),
  text: legalDocumentTextSchema,
});

export const legalDocumentSectionSchema = z.discriminatedUnion('type', [
  legalDocumentHeadingSectionSchema,
  legalDocumentParagraphSectionSchema,
  legalDocumentListSectionSchema,
  legalDocumentTableSectionSchema,
  legalDocumentCalloutSectionSchema,
]);

export const legalDocumentResponseSchema = z.strictObject({
  id: z.string().trim().min(1).max(128),
  kind: legalDocumentKindSchema,
  version: legalDocumentVersionIdSchema,
  title: legalDocumentTitleSchema,
  effectiveAt: isoDateTimeStringSchema,
  lastModifiedAt: isoDateTimeStringSchema,
  summaryItems: z.array(legalDocumentSummaryItemSchema).default([]),
  sections: z.array(legalDocumentSectionSchema).min(1),
  changeSummary: legalDocumentTextSchema.optional(),
});

function legalDocumentOf(kind: LegalDocumentKind) {
  return legalDocumentResponseSchema.refine((document) => document.kind === kind, {
    message: `Expected legal document kind ${kind}`,
    path: ['kind'],
  });
}

export const activeLegalDocumentsBundleResponseSchema = z.strictObject({
  termsOfService: legalDocumentOf(LegalDocumentKind.TERMS_OF_SERVICE),
  privacyPolicy: legalDocumentOf(LegalDocumentKind.PRIVACY_POLICY),
  personalDataCollectionUseConsent: legalDocumentOf(
    LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT,
  ),
  age14OrAboveNotice: legalDocumentOf(LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE),
});

export const signupLegalAcceptancesSchema = z.strictObject({
  termsVersionId: legalDocumentVersionIdSchema,
  personalDataConsentVersionId: legalDocumentVersionIdSchema,
  ageNoticeVersionId: legalDocumentVersionIdSchema,
  privacyPolicyVersionIdShown: legalDocumentVersionIdSchema,
});

export type LegalDocumentKind = z.infer<typeof legalDocumentKindSchema>;
export type LegalAcceptanceAction = z.infer<typeof legalAcceptanceActionSchema>;
export type LegalDocumentSection = z.infer<typeof legalDocumentSectionSchema>;
export type LegalDocumentResponse = z.infer<typeof legalDocumentResponseSchema>;
export type ActiveLegalDocumentsBundleResponse = z.infer<
  typeof activeLegalDocumentsBundleResponseSchema
>;
export type SignupLegalAcceptances = z.infer<typeof signupLegalAcceptancesSchema>;

// Version model: published versions keyed by their effective date (KST), the public reading responses,
// reconsent and the backoffice draft import format. Public responses never carry raw status names,
// authors, approvers or digests.

const LEGAL_VERSION_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string): boolean {
  if (!LEGAL_VERSION_KEY_PATTERN.test(value)) {
    return false;
  }
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** A version key: the effective date as a real `YYYY-MM-DD` calendar date in KST. */
export const legalVersionKeySchema = z.string().refine(isCalendarDate, {
  message: 'Expected a YYYY-MM-DD calendar date',
});

export const legalNoticeClassSchema = z.enum(['HISTORICAL', 'INITIAL', 'GENERAL', 'SIGNIFICANT']);
export const LegalNoticeClass = legalNoticeClassSchema.enum;

export const legalVersionStatusSchema = z.enum(['scheduled', 'current', 'previous']);
export const LegalVersionStatus = legalVersionStatusSchema.enum;

/** Kinds agreed to at signup; only these can ask existing members to consent again. */
export const legalConsentKindSchema = z.enum([
  'TERMS_OF_SERVICE',
  'PERSONAL_DATA_COLLECTION_USE_CONSENT',
  'AGE_14_OR_ABOVE_NOTICE',
]);
export const LEGAL_CONSENT_KINDS: readonly LegalDocumentKind[] = legalConsentKindSchema.options;

export const legalVersionSummarySchema = z.strictObject({
  versionKey: legalVersionKeySchema,
  status: legalVersionStatusSchema,
  appliesFrom: legalVersionKeySchema,
  appliesUntil: legalVersionKeySchema.nullable(),
  changeSummary: legalDocumentTextSchema,
  consentRequired: z.boolean(),
});

export const legalDocumentPageViewingSchema = legalDocumentResponseSchema.extend({
  versionKey: legalVersionKeySchema,
  status: legalVersionStatusSchema,
  appliesFrom: legalVersionKeySchema,
  appliesUntil: legalVersionKeySchema.nullable(),
});

export const legalDocumentPageResponseSchema = z.strictObject({
  kind: legalDocumentKindSchema,
  viewing: legalDocumentPageViewingSchema,
  versions: z.array(legalVersionSummarySchema).min(1),
  scheduled: legalVersionSummarySchema.nullable(),
});

export const legalArticleChangeSchema = z.enum(['added', 'removed', 'changed', 'unchanged']);

export const legalArticleComparisonSchema = z.strictObject({
  /** The level 2 heading text; null for the sections before the first article. */
  heading: legalDocumentTitleSchema.nullable(),
  change: legalArticleChangeSchema,
  before: z.array(legalDocumentSectionSchema),
  after: z.array(legalDocumentSectionSchema),
});

export const legalVersionComparisonSchema = z.strictObject({
  kind: legalDocumentKindSchema,
  versionKey: legalVersionKeySchema,
  previousVersionKey: legalVersionKeySchema.nullable(),
  articles: z.array(legalArticleComparisonSchema),
});

export const legalRevisionNoticeSchema = legalVersionSummarySchema.extend({
  kind: legalDocumentKindSchema,
  status: z.literal('scheduled'),
});

export const legalRevisionNoticesResponseSchema = z.strictObject({
  notices: z.array(legalRevisionNoticeSchema),
});

export const legalPendingConsentSchema = z.strictObject({
  kind: legalConsentKindSchema,
  /** The version in effect: consenting to it covers every earlier version that asked again. */
  document: legalDocumentResponseSchema,
});

export const legalPendingConsentsResponseSchema = z.strictObject({
  pending: z.array(legalPendingConsentSchema),
});

export const legalConsentRecordRequestSchema = z.strictObject({
  documentVersionIds: z
    .array(legalDocumentVersionIdSchema)
    .min(1)
    .max(legalConsentKindSchema.options.length),
});

/** A backoffice draft created from a JSON file (and the repository's first revision draft). */
export const legalDocumentDraftImportSchema = z
  .strictObject({
    kind: legalDocumentKindSchema,
    title: legalDocumentTitleSchema,
    summaryItems: z.array(legalDocumentSummaryItemSchema).default([]),
    sections: z.array(legalDocumentSectionSchema).min(1),
    changeSummary: legalDocumentTextSchema,
    noticeClass: legalNoticeClassSchema,
    consentRequired: z.boolean(),
    proposedEffectiveDate: legalVersionKeySchema,
    /** The last applied day of a historical record; no other class has one. */
    appliesUntil: legalVersionKeySchema.optional(),
  })
  .superRefine((draft, context) => {
    const historical = draft.noticeClass === 'HISTORICAL';
    if (historical !== (draft.appliesUntil !== undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['appliesUntil'],
        message: 'Only a historical record has an applies-until date, and it always has one',
      });
    }
    if (draft.appliesUntil !== undefined && draft.appliesUntil < draft.proposedEffectiveDate) {
      context.addIssue({
        code: 'custom',
        path: ['appliesUntil'],
        message: 'The applies-until date cannot be before the effective date',
      });
    }
    if (draft.consentRequired && (historical || !LEGAL_CONSENT_KINDS.includes(draft.kind))) {
      context.addIssue({
        code: 'custom',
        path: ['consentRequired'],
        message: 'Only a signup consent kind in force can ask for consent again',
      });
    }
    if (
      draft.kind === 'TERMS_OF_SERVICE' &&
      draft.noticeClass === 'SIGNIFICANT' &&
      !draft.consentRequired
    ) {
      context.addIssue({
        code: 'custom',
        path: ['consentRequired'],
        message: 'A significant terms of service change asks for consent again',
      });
    }
  });

export type LegalVersionKey = z.infer<typeof legalVersionKeySchema>;
export type LegalNoticeClass = z.infer<typeof legalNoticeClassSchema>;
export type LegalVersionStatus = z.infer<typeof legalVersionStatusSchema>;
export type LegalConsentKind = z.infer<typeof legalConsentKindSchema>;
export type LegalVersionSummary = z.infer<typeof legalVersionSummarySchema>;
export type LegalDocumentPageViewing = z.infer<typeof legalDocumentPageViewingSchema>;
export type LegalDocumentPageResponse = z.infer<typeof legalDocumentPageResponseSchema>;
export type LegalArticleChange = z.infer<typeof legalArticleChangeSchema>;
export type LegalArticleComparison = z.infer<typeof legalArticleComparisonSchema>;
export type LegalVersionComparison = z.infer<typeof legalVersionComparisonSchema>;
export type LegalRevisionNotice = z.infer<typeof legalRevisionNoticeSchema>;
export type LegalRevisionNoticesResponse = z.infer<typeof legalRevisionNoticesResponseSchema>;
export type LegalPendingConsent = z.infer<typeof legalPendingConsentSchema>;
export type LegalPendingConsentsResponse = z.infer<typeof legalPendingConsentsResponseSchema>;
export type LegalConsentRecordRequest = z.infer<typeof legalConsentRecordRequestSchema>;
export type LegalDocumentDraftImport = z.infer<typeof legalDocumentDraftImportSchema>;
