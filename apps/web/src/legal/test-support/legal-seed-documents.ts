// Test-only legal documents built from the API legal seed (one source for test, story and e2e text). Production
// code may not import apps/web/src/legal/test-support (eslint import/no-restricted-paths); tests, stories and the Playwright
// fixture read it. Each body goes through the shared import schema the seed also parses with, and each response through
// the shared public contract, so a story or a test renders what the development API would answer.
import {
  LegalDocumentKind,
  activeLegalDocumentsBundleResponseSchema,
  buildLegalVersionTimeline,
  compareLegalSections,
  legalDocumentDraftImportSchema,
  legalDocumentPageResponseSchema,
  legalDocumentResponseSchema,
  legalEffectiveInstant,
  legalRevisionNoticesResponseSchema,
  legalVersionComparisonSchema,
  type ActiveLegalDocumentsBundleResponse,
  type LegalDocumentDraftImport,
  type LegalDocumentKind as LegalDocumentKindValue,
  type LegalDocumentPageResponse,
  type LegalDocumentResponse,
  type LegalNoticeClass,
  type LegalRevisionNoticesResponse,
  type LegalVersionComparison,
  type LegalVersionKey,
} from '@repo/shared/legal';
import { LEGAL_SEED_SOURCE } from './legal-seed-source.mjs';

/** The clock the seed timeline is computed with: after every seed version took effect. */
export const LEGAL_SEED_CLOCK = new Date('2026-11-26T03:00:00.000Z');

interface SeedVersion {
  readonly id: string;
  readonly kind: LegalDocumentKindValue;
  readonly version: string;
  readonly body: LegalDocumentDraftImport;
  readonly noticeClass: LegalNoticeClass;
  readonly effectiveDate: LegalVersionKey;
  readonly appliesUntil: LegalVersionKey | null;
  readonly publishedAt: Date;
  readonly withdrawnAt: null;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`[legal seed] ${label} is not an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`[legal seed] ${label} is not a string`);
  }
  return value;
}

/** The body a version row copies: the reference row with the same id, or a JSON content file (seed-legal-documents.js). */
function contentOf(row: Record<string, unknown>): Record<string, unknown> {
  const id = text(row.id, 'version id');
  if (row.content === 'reference-row') {
    const reference = LEGAL_SEED_SOURCE.referenceRows
      .map((candidate) => record(candidate, 'reference row'))
      .find((candidate) => candidate.id === id);
    if (!reference) throw new Error(`[legal seed] missing reference row ${id}`);
    return reference;
  }
  const file = LEGAL_SEED_SOURCE.contentFiles[text(row.content, `${id} content`)];
  if (file === undefined) throw new Error(`[legal seed] ${id} names an unknown content file`);
  return record(file, `${id} content`);
}

function seedVersions(): SeedVersion[] {
  return LEGAL_SEED_SOURCE.versionRows.map((value) => {
    const row = record(value, 'version row');
    const content = contentOf(row);
    const noticeClass = text(row.noticeClass, 'notice class') as LegalNoticeClass;
    const effectiveDate = text(row.effectiveDate, 'effective date');
    const appliesUntil = row.appliesUntil === null ? null : text(row.appliesUntil, 'applies until');
    const body = legalDocumentDraftImportSchema.parse({
      kind: content.kind,
      contentSchemaVersion: 1,
      title: content.title,
      summaryItems: content.summaryItems,
      sections: content.sections,
      changeSummary: content.changeSummary,
      noticeClass,
      consentRequired: row.consentRequired,
      proposedEffectiveDate: effectiveDate,
      ...(appliesUntil === null ? {} : { appliesUntil }),
    });
    return {
      id: text(row.id, 'version id'),
      kind: body.kind,
      version: text(content.version, 'version'),
      body,
      noticeClass,
      effectiveDate,
      appliesUntil,
      publishedAt: legalEffectiveInstant(effectiveDate),
      withdrawnAt: null,
    };
  });
}

const SEED_VERSIONS = seedVersions();

function timelineOf(kind: LegalDocumentKindValue) {
  return buildLegalVersionTimeline(
    SEED_VERSIONS.filter((version) => version.kind === kind),
    LEGAL_SEED_CLOCK,
  );
}

type SeedEntry = ReturnType<typeof timelineOf>[number];

function documentOf(entry: SeedEntry): LegalDocumentResponse {
  return legalDocumentResponseSchema.parse({
    id: entry.id,
    kind: entry.kind,
    version: entry.version,
    title: entry.body.title,
    effectiveAt: `${entry.effectiveDate}T00:00:00.000Z`,
    lastModifiedAt: `${entry.lastModifiedDate}T00:00:00.000Z`,
    summaryItems: entry.body.summaryItems,
    sections: entry.body.sections,
    changeSummary: entry.body.changeSummary,
  });
}

function summaryOf(entry: SeedEntry) {
  return {
    versionKey: entry.effectiveDate,
    status: entry.status,
    appliesFrom: entry.appliesFrom,
    appliesUntil: entry.appliesUntil,
    changeSummary: entry.body.changeSummary,
    consentRequired: entry.body.consentRequired,
  };
}

function currentOf(kind: LegalDocumentKindValue): SeedEntry {
  const current = timelineOf(kind).find((entry) => entry.status === 'current');
  if (!current) throw new Error(`[legal seed] ${kind} has no version in effect`);
  return current;
}

/** `GET /api/legal/documents/:kind/active`: the version in effect. */
export function seedActiveLegalDocument(kind: LegalDocumentKindValue): LegalDocumentResponse {
  return documentOf(currentOf(kind));
}

/** `GET /api/legal/documents/active-bundle`: the four signup documents in effect. */
export function seedActiveLegalDocumentsBundle(): ActiveLegalDocumentsBundleResponse {
  return activeLegalDocumentsBundleResponseSchema.parse({
    termsOfService: seedActiveLegalDocument(LegalDocumentKind.TERMS_OF_SERVICE),
    privacyPolicy: seedActiveLegalDocument(LegalDocumentKind.PRIVACY_POLICY),
    personalDataCollectionUseConsent: seedActiveLegalDocument(
      LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT,
    ),
    age14OrAboveNotice: seedActiveLegalDocument(LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE),
  });
}

/** `GET /api/legal/documents/:kind/page?version=`: the version in effect without a key. Null for a key with no version. */
export function seedLegalDocumentPage(
  kind: LegalDocumentKindValue,
  versionKey?: LegalVersionKey,
): LegalDocumentPageResponse | null {
  const timeline = timelineOf(kind);
  const viewing =
    versionKey === undefined
      ? currentOf(kind)
      : timeline.find((entry) => entry.effectiveDate === versionKey);
  if (!viewing) return null;
  const scheduled = timeline.find((entry) => entry.status === 'scheduled');
  return legalDocumentPageResponseSchema.parse({
    kind,
    viewing: {
      ...documentOf(viewing),
      versionKey: viewing.effectiveDate,
      status: viewing.status,
      appliesFrom: viewing.appliesFrom,
      appliesUntil: viewing.appliesUntil,
    },
    versions: timeline.map(summaryOf),
    scheduled: scheduled ? summaryOf(scheduled) : null,
  });
}

/** `GET /api/legal/documents/:kind/versions/:versionKey/comparison`. Null for a key with no version. */
export function seedLegalVersionComparison(
  kind: LegalDocumentKindValue,
  versionKey: LegalVersionKey,
): LegalVersionComparison | null {
  const timeline = timelineOf(kind);
  const index = timeline.findIndex((entry) => entry.effectiveDate === versionKey);
  const target = timeline[index];
  if (!target) return null;
  const previous = timeline[index + 1] ?? null;
  return legalVersionComparisonSchema.parse({
    kind,
    versionKey: target.effectiveDate,
    previousVersionKey: previous?.effectiveDate ?? null,
    articles: compareLegalSections(previous?.body.sections ?? null, target.body.sections),
  });
}

/** `GET /api/legal/revision-notices`: the seed has no scheduled version (first revisions are import drafts). */
export function seedLegalRevisionNotices(): LegalRevisionNoticesResponse {
  return legalRevisionNoticesResponseSchema.parse({
    notices: Object.values(LegalDocumentKind).flatMap((kind) =>
      timelineOf(kind)
        .filter((entry) => entry.status === 'scheduled')
        .map((entry) => ({ kind, ...summaryOf(entry), status: 'scheduled' as const })),
    ),
  });
}

/** The first revision import drafts (privacy policy, terms of service), parsed with the shared import schema. */
export function seedLegalFirstRevisionDraft(
  kind: 'PRIVACY_POLICY' | 'TERMS_OF_SERVICE',
): LegalDocumentDraftImport {
  return legalDocumentDraftImportSchema.parse(LEGAL_SEED_SOURCE.firstRevisionDrafts[kind]);
}
