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
