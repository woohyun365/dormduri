import {
  LegalDocumentKind,
  activeLegalDocumentsBundleResponseSchema,
  legalDocumentPageResponseSchema,
  legalDocumentResponseSchema,
  legalRevisionNoticesResponseSchema,
  legalVersionComparisonSchema,
  legalVersionSummarySchema,
  type ActiveLegalDocumentsBundleResponse,
  type LegalArticleComparison,
  type LegalDocumentPageResponse,
  type LegalDocumentResponse,
  type LegalRevisionNoticesResponse,
  type LegalVersionComparison,
  type LegalVersionKey,
  type LegalVersionSummary,
} from '@repo/shared/legal';
import type { LegalVersionEntry } from '../domain/legal-version.js';

/**
 * The old endpoints' date form: the KST date with `T00:00:00.000Z`. The Web reads the first ten
 * characters as the date, so the 00:00 KST instant itself (the day before in UTC) is never sent.
 */
function dateAsLegacyTimestamp(versionKey: LegalVersionKey): string {
  return `${versionKey}T00:00:00.000Z`;
}

/** Public allowlist: no notice class, digest, author, approver, withdrawal or approval time. */
export function toLegalDocumentResponse(entry: LegalVersionEntry): LegalDocumentResponse {
  return legalDocumentResponseSchema.parse({
    id: entry.id,
    kind: entry.kind,
    version: entry.version,
    title: entry.title,
    effectiveAt: dateAsLegacyTimestamp(entry.effectiveDate),
    lastModifiedAt: dateAsLegacyTimestamp(entry.lastModifiedDate),
    summaryItems: entry.summaryItems,
    sections: entry.sections,
    changeSummary: entry.changeSummary,
  });
}

export function toLegalVersionSummary(entry: LegalVersionEntry): LegalVersionSummary {
  return legalVersionSummarySchema.parse({
    versionKey: entry.effectiveDate,
    status: entry.status,
    appliesFrom: entry.appliesFrom,
    appliesUntil: entry.appliesUntil,
    changeSummary: entry.changeSummary,
    consentRequired: entry.consentRequired,
  });
}

export function toLegalDocumentPageResponse(input: {
  kind: LegalDocumentKind;
  viewing: LegalVersionEntry;
  timeline: readonly LegalVersionEntry[];
}): LegalDocumentPageResponse {
  const scheduled = input.timeline.find((entry) => entry.status === 'scheduled');
  return legalDocumentPageResponseSchema.parse({
    kind: input.kind,
    viewing: {
      ...toLegalDocumentResponse(input.viewing),
      versionKey: input.viewing.effectiveDate,
      status: input.viewing.status,
      appliesFrom: input.viewing.appliesFrom,
      appliesUntil: input.viewing.appliesUntil,
    },
    versions: input.timeline.map(toLegalVersionSummary),
    scheduled: scheduled ? toLegalVersionSummary(scheduled) : null,
  });
}

export function toLegalVersionComparison(input: {
  kind: LegalDocumentKind;
  versionKey: LegalVersionKey;
  previousVersionKey: LegalVersionKey | null;
  articles: readonly LegalArticleComparison[];
}): LegalVersionComparison {
  return legalVersionComparisonSchema.parse(input);
}

export function toLegalRevisionNoticesResponse(
  scheduled: ReadonlyArray<{ kind: LegalDocumentKind; entry: LegalVersionEntry }>,
): LegalRevisionNoticesResponse {
  return legalRevisionNoticesResponseSchema.parse({
    notices: scheduled.map(({ kind, entry }) => ({ kind, ...toLegalVersionSummary(entry) })),
  });
}

export function toActiveLegalDocumentsBundleResponse(input: {
  termsOfService: LegalVersionEntry;
  privacyPolicy: LegalVersionEntry;
  personalDataCollectionUseConsent: LegalVersionEntry;
  age14OrAboveNotice: LegalVersionEntry;
}): ActiveLegalDocumentsBundleResponse {
  return activeLegalDocumentsBundleResponseSchema.parse({
    termsOfService: toLegalDocumentResponse(input.termsOfService),
    privacyPolicy: toLegalDocumentResponse(input.privacyPolicy),
    personalDataCollectionUseConsent: toLegalDocumentResponse(
      input.personalDataCollectionUseConsent,
    ),
    age14OrAboveNotice: toLegalDocumentResponse(input.age14OrAboveNotice),
  });
}

export const REQUIRED_ACTIVE_LEGAL_DOCUMENT_KINDS = [
  LegalDocumentKind.TERMS_OF_SERVICE,
  LegalDocumentKind.PRIVACY_POLICY,
  LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT,
  LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE,
] as const;
