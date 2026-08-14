import {
  LegalDocumentKind,
  activeLegalDocumentsBundleResponseSchema,
  legalDocumentResponseSchema,
  type ActiveLegalDocumentsBundleResponse,
  type LegalDocumentResponse,
} from '@repo/shared/legal';
import type { LegalDocumentVersionRecord } from '../repositories/legal-document.repository.js';

export function toLegalDocumentResponse(record: LegalDocumentVersionRecord): LegalDocumentResponse {
  return legalDocumentResponseSchema.parse({
    id: record.id,
    kind: record.kind,
    version: record.version,
    title: record.title,
    effectiveAt: record.effectiveAt.toISOString(),
    lastModifiedAt: record.updatedAt.toISOString(),
    summaryItems: record.summaryItems,
    sections: record.sections,
    ...(record.changeSummary ? { changeSummary: record.changeSummary } : {}),
  });
}

export function toActiveLegalDocumentsBundleResponse(input: {
  termsOfService: LegalDocumentVersionRecord;
  privacyPolicy: LegalDocumentVersionRecord;
  personalDataCollectionUseConsent: LegalDocumentVersionRecord;
  age14OrAboveNotice: LegalDocumentVersionRecord;
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
