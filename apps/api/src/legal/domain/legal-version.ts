import {
  buildLegalVersionTimeline,
  type LegalDocumentKind,
  type LegalNoticeClass,
  type LegalTimelineEntry,
  type LegalVersionKey,
} from '@repo/shared/legal';
import type { LegalDocumentVersionRecord } from '../repositories/legal-document.repository.js';

/** A published version in the form the shared timeline reads (dates as KST version keys). */
export interface LegalVersion {
  readonly id: string;
  readonly kind: LegalDocumentKind;
  readonly version: string;
  readonly title: string;
  readonly summaryItems: unknown;
  readonly sections: unknown;
  readonly changeSummary: string;
  readonly noticeClass: LegalNoticeClass;
  readonly consentRequired: boolean;
  readonly effectiveDate: LegalVersionKey;
  readonly appliesUntil: LegalVersionKey | null;
  readonly publishedAt: Date;
  readonly withdrawnAt: Date | null;
}

export type LegalVersionEntry = LegalTimelineEntry<LegalVersion>;

/** Prisma returns a `@db.Date` column as that calendar date at 00:00 UTC. */
function toVersionKey(date: Date): LegalVersionKey {
  return date.toISOString().slice(0, 10);
}

interface LegalStoredBody {
  readonly summaryItems: unknown;
  readonly sections: unknown;
}

/**
 * Body readers by content schema version. A published body never changes, so an incompatible change to
 * the section schema adds a version and a reader that turns the older body into today's shape (DB
 * decision `db.schema.history-model/legal`). The DB CHECK allows only the versions listed here.
 */
const LEGAL_BODY_READERS: Readonly<Record<number, (body: LegalStoredBody) => LegalStoredBody>> = {
  1: (body) => body,
};

export function toLegalVersion(record: LegalDocumentVersionRecord): LegalVersion {
  const readBody = LEGAL_BODY_READERS[record.contentSchemaVersion];
  if (!readBody) {
    throw new Error(
      `[LegalVersion] content schema version ${record.contentSchemaVersion} has no reader`,
    );
  }
  const body = readBody({ summaryItems: record.summaryItems, sections: record.sections });
  return {
    id: record.id,
    kind: record.kind,
    version: record.version,
    title: record.title,
    summaryItems: body.summaryItems,
    sections: body.sections,
    changeSummary: record.changeSummary,
    noticeClass: record.noticeClass,
    consentRequired: record.consentRequired,
    effectiveDate: toVersionKey(record.effectiveDate),
    appliesUntil: record.appliesUntil ? toVersionKey(record.appliesUntil) : null,
    publishedAt: record.publishedAt,
    withdrawnAt: record.withdrawnAt,
  };
}

/** Newest first; see `buildLegalVersionTimeline` for the rules. */
export function legalTimelineOf(versions: readonly LegalVersion[], now: Date): LegalVersionEntry[] {
  return buildLegalVersionTimeline(versions, now);
}

export function currentLegalVersionOf(
  timeline: readonly LegalVersionEntry[],
): LegalVersionEntry | null {
  return timeline.find((entry) => entry.status === 'current') ?? null;
}
