import type {
  LegalArticleChange,
  LegalDocumentPageResponse,
  LegalDocumentResponse,
  LegalDocumentSection,
  LegalVersionComparison,
  LegalVersionStatus,
} from '@repo/shared/legal';
import {
  legalDocumentPaths,
  legalVersionHref,
  type PublicLegalDocumentKind,
} from '../../ui/model/legalAddress';
import { formatLegalDate } from '../../ui/model/legalDates';

// Input → screen model for a public legal document page. Renderer-neutral: no React, DOM or Next.js.
// The input is the public reading contract (`/page` and `/comparison`); the screen never works out
// which version is in force, the periods or the comparison itself (G-LU5). The sections stay in source
// order with their text untouched (G-LU1); headings only gain an id so the table of contents can link
// to them (G-LU3).

export type LegalHeadingBlock = Extract<LegalDocumentSection, { type: 'heading' }> & { id: string };
export type LegalBlock = LegalHeadingBlock | Exclude<LegalDocumentSection, { type: 'heading' }>;

export type LegalTocItem = { id: string; level: 2 | 3 | 4; text: string };

// The change summary is free text the backoffice writes. The words before the major-change marker are a
// short summary line and each sentence after it is one major change; without the marker, or with nothing
// after it, the whole text is the summary line. Every character stays: sentences split only at their end
// ('…다.' and a space) and the marker's colon becomes the label of the major-change list (Owner
// 2026-11-26).
export type LegalChangeSummaryView = {
  summary: string | undefined;
  majorChanges: string[];
};

const MAJOR_CHANGE_MARKER = '주요 변경:';
export const MAJOR_CHANGE_LABEL = MAJOR_CHANGE_MARKER.slice(0, -1);
const SENTENCE_END = /(?<=다\.)\s+/;

export function toLegalChangeSummaryView(text: string): LegalChangeSummaryView {
  const at = text.indexOf(MAJOR_CHANGE_MARKER);
  const after = at < 0 ? '' : text.slice(at + MAJOR_CHANGE_MARKER.length).trim();
  if (!after) return { summary: text, majorChanges: [] };
  const summary = text.slice(0, at).trim();
  return { summary: summary || undefined, majorChanges: after.split(SENTENCE_END) };
}

export type LegalDocumentView = {
  title: string;
  summaryItems: string[];
  changeSummary: LegalChangeSummaryView | undefined;
  effectiveDate: string;
  lastModifiedDate: string;
  blocks: LegalBlock[];
  toc: LegalTocItem[];
};

export function headingId(text: string, index: number): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[\s/·]+/g, '-')
    .replace(/[^\p{Letter}\p{Number}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug ? `section-${index + 1}-${slug}` : `section-${index + 1}`;
}

export function toLegalDocumentView(document: LegalDocumentResponse): LegalDocumentView {
  const blocks: LegalBlock[] = document.sections.map((section, index) =>
    section.type === 'heading' ? { ...section, id: headingId(section.text, index) } : section,
  );
  const toc = blocks
    .filter((block): block is LegalHeadingBlock => block.type === 'heading')
    .map(({ id, level, text }) => ({ id, level, text }));
  return {
    title: document.title,
    summaryItems: document.summaryItems,
    changeSummary: document.changeSummary
      ? toLegalChangeSummaryView(document.changeSummary)
      : undefined,
    effectiveDate: formatLegalDate(document.effectiveAt),
    lastModifiedDate: formatLegalDate(document.lastModifiedAt),
    blocks,
    toc,
  };
}

// A version's period of application as the contract gives it (`appliesUntil` null: no end yet).
export type LegalVersionPeriod = { from: string; until: string | null };

// One line of the version list, newest first: a version announced and not yet in force, the one in
// force, and earlier ones. `viewing` marks the version on screen; the others link to their address.
export type LegalVersionRow = {
  versionKey: string;
  status: LegalVersionStatus;
  period: LegalVersionPeriod;
  href: string;
  viewing: boolean;
};

export function toLegalVersionRows(
  kind: PublicLegalDocumentKind,
  page: LegalDocumentPageResponse,
): LegalVersionRow[] {
  return page.versions.map((version) => ({
    versionKey: version.versionKey,
    status: version.status,
    period: { from: version.appliesFrom, until: version.appliesUntil },
    href: legalVersionHref(kind, version),
    viewing: version.versionKey === page.viewing.versionKey,
  }));
}

export function formatVersionPeriod(period: LegalVersionPeriod): string {
  const from = formatLegalDate(period.from);
  return period.until ? `${from} ~ ${formatLegalDate(period.until)}` : `${from}부터`;
}

// The notices above the document: on a version other than the one in force, which version it is and
// a link to the one in force; on the version in force, an announced new version and a link to it.
export type LegalPageNotice =
  | {
      kind: 'other-version';
      status: Exclude<LegalVersionStatus, 'current'>;
      period: LegalVersionPeriod;
      currentHref: string;
    }
  | { kind: 'scheduled'; appliesFrom: string; href: string };

export function toLegalPageNotices(
  kind: PublicLegalDocumentKind,
  page: LegalDocumentPageResponse,
): LegalPageNotice[] {
  const { viewing, scheduled } = page;
  if (viewing.status !== 'current') {
    return [
      {
        kind: 'other-version',
        status: viewing.status,
        period: { from: viewing.appliesFrom, until: viewing.appliesUntil },
        currentHref: legalDocumentPaths[kind],
      },
    ];
  }
  if (scheduled === null) return [];
  return [
    {
      kind: 'scheduled',
      appliesFrom: scheduled.appliesFrom,
      href: legalVersionHref(kind, scheduled),
    },
  ];
}

// The comparison with the version before: the changed, added and removed articles in their order, a
// line when no article changed, nothing for a first version, a line when it cannot be read.
export type LegalComparisonArticle = {
  heading: string | null;
  change: Exclude<LegalArticleChange, 'unchanged'>;
  before: LegalDocumentSection[];
  after: LegalDocumentSection[];
};

export type LegalComparisonView =
  | { state: 'table'; articles: LegalComparisonArticle[] }
  | { state: 'unchanged' }
  | { state: 'first' }
  | { state: 'unavailable' };

// Without a comparison, the page's own list still tells a first version: no version applied before it.
export function toLegalComparisonView(
  comparison: LegalVersionComparison | null,
  page?: LegalDocumentPageResponse,
): LegalComparisonView {
  if (comparison === null) {
    const first =
      page !== undefined &&
      !page.versions.some((row) => row.appliesFrom < page.viewing.appliesFrom);
    return { state: first ? 'first' : 'unavailable' };
  }
  if (comparison.previousVersionKey === null) return { state: 'first' };
  const articles = comparison.articles.filter(
    (article): article is LegalComparisonArticle => article.change !== 'unchanged',
  );
  return articles.length === 0 ? { state: 'unchanged' } : { state: 'table', articles };
}

// When this server last confirmed a kept copy, in the reader's words and Korean time:
// '2026-11-25T09:30:00.000Z' → '2026년 11월 25일 18:30'.
export function formatLegalCheckedAt(isoDateTime: string): string {
  const time = Date.parse(isoDateTime);
  if (Number.isNaN(time)) return formatLegalDate(isoDateTime);
  // Korea keeps UTC+9 all year, so the shift is fixed.
  const korea = new Date(time + 9 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${korea.getUTCFullYear()}년 ${korea.getUTCMonth() + 1}월 ${korea.getUTCDate()}일 ${pad(
    korea.getUTCHours(),
  )}:${pad(korea.getUTCMinutes())}`;
}
