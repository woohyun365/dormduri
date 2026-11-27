import {
  LegalDocumentKind,
  compareLegalSections,
  legalDocumentPageResponseSchema,
  legalVersionComparisonSchema,
  type LegalDocumentDraftImport,
  type LegalDocumentPageResponse,
  type LegalDocumentResponse,
  type LegalVersionComparison,
  type LegalVersionSummary,
} from '@repo/shared/legal';
import {
  seedLegalDocumentPage,
  seedLegalFirstRevisionDraft,
  seedLegalVersionComparison,
} from '@/legal/test-support/legal-seed-documents';
import { sectionKindSample } from './sectionKindSample';

// Story and screen test inputs in the public reading contract's shape (`/page`, `/comparison`), every
// one parsed with the shared schema. The text is the development seed through the test-only seed path
// (D-LU10): the privacy policy's version in force (2026-11-20) and its earlier version (2026-06-22 ~
// 2026-11-19), the terms' one version, and the privacy policy's first revision draft as the scheduled
// sample. The terms have one version, so their scheduled and earlier samples are the same text under
// other dates (display samples, no copy of the text is kept). The section kind sample is made-up short
// text for render coverage.

const PRIVACY = LegalDocumentKind.PRIVACY_POLICY;
const TERMS = LegalDocumentKind.TERMS_OF_SERVICE;

export const STORY_CHECKED_AT = '2026-11-25T09:30:00.000Z';

function required<T>(value: T | null, label: string): T {
  if (value === null) throw new Error(`[legal stories] the seed has no ${label}`);
  return value;
}

function dayBefore(versionKey: string): string {
  const date = new Date(`${versionKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function page(value: unknown): LegalDocumentPageResponse {
  return legalDocumentPageResponseSchema.parse(value);
}

function comparison(value: unknown): LegalVersionComparison {
  return legalVersionComparisonSchema.parse(value);
}

function summaryOf(viewing: LegalDocumentPageResponse['viewing']): LegalVersionSummary {
  return {
    versionKey: viewing.versionKey,
    status: viewing.status,
    appliesFrom: viewing.appliesFrom,
    appliesUntil: viewing.appliesUntil,
    changeSummary: viewing.changeSummary ?? '',
    consentRequired: false,
  };
}

// A scheduled version made from a body: it applies from `versionKey`, so the one in force ends the day before.
function scheduledViewing(
  body: Pick<LegalDocumentResponse, 'title' | 'summaryItems' | 'sections' | 'changeSummary'>,
  kind: typeof PRIVACY | typeof TERMS,
  versionKey: string,
): LegalDocumentPageResponse['viewing'] {
  return {
    id: `story-${kind}-${versionKey}`,
    kind,
    version: `story-${kind}-${versionKey}`,
    title: body.title,
    effectiveAt: `${versionKey}T00:00:00.000Z`,
    lastModifiedAt: `${dayBefore(dayBefore(versionKey))}T00:00:00.000Z`,
    summaryItems: body.summaryItems,
    sections: body.sections,
    changeSummary: body.changeSummary,
    versionKey,
    status: 'scheduled',
    appliesFrom: versionKey,
    appliesUntil: null,
  };
}

// --- The privacy policy -------------------------------------------------------------------------

const privacyCurrent = required(seedLegalDocumentPage(PRIVACY), 'privacy policy in force');
const privacyPrevious = required(
  seedLegalDocumentPage(PRIVACY, '2026-06-22'),
  'earlier privacy policy',
);
const privacyDraft: LegalDocumentDraftImport = seedLegalFirstRevisionDraft('PRIVACY_POLICY');
const privacyScheduledKey = privacyDraft.proposedEffectiveDate;
const privacyScheduled = scheduledViewing(privacyDraft, PRIVACY, privacyScheduledKey);
const privacyCurrentUntilScheduled = {
  ...privacyCurrent.viewing,
  appliesUntil: dayBefore(privacyScheduledKey),
};
const privacyVersionsWithScheduled = [
  summaryOf(privacyScheduled),
  summaryOf(privacyCurrentUntilScheduled),
  ...privacyCurrent.versions.filter((version) => version.status === 'previous'),
];

export const privacyPage = privacyCurrent;
export const privacyComparison = required(
  seedLegalVersionComparison(PRIVACY, privacyCurrent.viewing.versionKey),
  'privacy policy comparison',
);

export const privacyPreviousPage = privacyPrevious;
export const privacyPreviousComparison = required(
  seedLegalVersionComparison(PRIVACY, privacyPrevious.viewing.versionKey),
  'earlier privacy policy comparison',
);

export const privacyWithScheduledPage = page({
  ...privacyCurrent,
  viewing: privacyCurrentUntilScheduled,
  versions: privacyVersionsWithScheduled,
  scheduled: summaryOf(privacyScheduled),
});

export const privacyScheduledPage = page({
  kind: PRIVACY,
  viewing: privacyScheduled,
  versions: privacyVersionsWithScheduled,
  scheduled: summaryOf(privacyScheduled),
});

export const privacyScheduledComparison = comparison({
  kind: PRIVACY,
  versionKey: privacyScheduledKey,
  previousVersionKey: privacyCurrent.viewing.versionKey,
  articles: compareLegalSections(privacyCurrent.viewing.sections, privacyDraft.sections),
});

// --- The terms of service -----------------------------------------------------------------------

const termsCurrent = required(seedLegalDocumentPage(TERMS), 'terms in force');
// Display sample date for the terms' scheduled and later versions (the seed has one terms version).
const termsSampleKey = privacyScheduledKey;
const termsScheduled = scheduledViewing(
  {
    ...termsCurrent.viewing,
    changeSummary: '표시용 견본: 새 판의 변경 요약이 여기에 들어갑니다.',
  },
  TERMS,
  termsSampleKey,
);
const termsCurrentUntilScheduled = {
  ...termsCurrent.viewing,
  appliesUntil: dayBefore(termsSampleKey),
};

export const termsPage = termsCurrent;
export const termsComparison = required(
  seedLegalVersionComparison(TERMS, termsCurrent.viewing.versionKey),
  'terms comparison',
);

export const termsWithScheduledPage = page({
  ...termsCurrent,
  viewing: termsCurrentUntilScheduled,
  versions: [summaryOf(termsScheduled), summaryOf(termsCurrentUntilScheduled)],
  scheduled: summaryOf(termsScheduled),
});

export const termsScheduledPage = page({
  kind: TERMS,
  viewing: termsScheduled,
  versions: [summaryOf(termsScheduled), summaryOf(termsCurrentUntilScheduled)],
  scheduled: summaryOf(termsScheduled),
});

// The same text under a later date: every article is unchanged.
export const termsScheduledComparison = comparison({
  kind: TERMS,
  versionKey: termsSampleKey,
  previousVersionKey: termsCurrent.viewing.versionKey,
  articles: compareLegalSections(termsCurrent.viewing.sections, termsScheduled.sections),
});

// The earlier-version page for the terms assumes the sample version has come into force.
const termsLaterCurrent = {
  ...termsScheduled,
  status: 'current' as const,
  id: `story-${TERMS}-current`,
  version: `story-${TERMS}-current`,
};
export const termsPreviousPage = page({
  kind: TERMS,
  viewing: {
    ...termsCurrent.viewing,
    status: 'previous',
    appliesUntil: dayBefore(termsSampleKey),
  },
  versions: [
    summaryOf(termsLaterCurrent),
    { ...summaryOf(termsCurrentUntilScheduled), status: 'previous' },
  ],
  scheduled: null,
});
export const termsPreviousComparison = comparison({
  kind: TERMS,
  versionKey: termsCurrent.viewing.versionKey,
  previousVersionKey: null,
  articles: [],
});

// --- Every section kind -------------------------------------------------------------------------

// The sample text is in sectionKindSample.ts, which the Storybook style test reads too.

export function sectionKindPage(kind: typeof PRIVACY | typeof TERMS): LegalDocumentPageResponse {
  const viewing = {
    ...sectionKindSample,
    id: 'section-kind-sample',
    kind,
    version: 'section-kind-sample',
    effectiveAt: '2026-06-22T00:00:00.000Z',
    lastModifiedAt: '2026-06-22T00:00:00.000Z',
    versionKey: '2026-06-22',
    status: 'current',
    appliesFrom: '2026-06-22',
    appliesUntil: null,
  } as const;
  return page({ kind, viewing, versions: [summaryOf(viewing)], scheduled: null });
}

export function firstVersionComparison(
  kind: typeof PRIVACY | typeof TERMS,
  versionKey: string,
): LegalVersionComparison {
  return comparison({ kind, versionKey, previousVersionKey: null, articles: [] });
}

// Addresses the stories link to, for the Storybook-only address → story map (storyLinks.tsx).
export const storyVersionKeys = {
  privacyPrevious: privacyPrevious.viewing.versionKey,
  privacyScheduled: privacyScheduledKey,
  termsScheduled: termsSampleKey,
  termsPrevious: termsCurrent.viewing.versionKey,
} as const;
