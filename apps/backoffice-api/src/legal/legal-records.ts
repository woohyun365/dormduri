import { createHash } from 'node:crypto';
import type { Prisma } from '@repo/database/client';
import { countLegalNoticeRecipients, getCurrentTimestamp } from '@repo/database/sql';
import type {
  LegalBackofficeVersion,
  LegalBackofficeVersionDetail,
  LegalDraft,
  LegalDraftContent,
  LegalRequest,
} from '@repo/shared/backoffice';
import {
  legalContentDigestInput,
  legalDocumentDraftImportSchema,
  legalEffectiveInstant,
  type LegalDocumentDraftImport,
  type LegalDocumentKind,
  type LegalNoticeClass,
  type LegalVersionKey,
} from '@repo/shared/legal';
import type { BackofficeTransaction } from '../platform/database/backoffice-prisma.js';
import { BackofficeApiError } from '../platform/http/api-error.js';
import type { LegalPublishedVersionFact } from './legal-publication-policy.js';

/** `@db.Date` values travel as UTC midnight; the version key is that calendar date. */
export const toVersionKey = (date: Date): LegalVersionKey => date.toISOString().slice(0, 10);
export const fromVersionKey = (key: LegalVersionKey): Date => new Date(`${key}T00:00:00.000Z`);

export const DRAFT_SELECT = {
  id: true,
  kind: true,
  basedOnVersionId: true,
  title: true,
  contentSchemaVersion: true,
  summaryItems: true,
  sections: true,
  changeSummary: true,
  noticeClass: true,
  consentRequired: true,
  proposedEffectiveDate: true,
  appliesUntil: true,
  status: true,
  revision: true,
  authorAccountId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface DraftRow {
  id: string;
  kind: LegalDocumentKind;
  basedOnVersionId: string | null;
  title: string;
  contentSchemaVersion: number;
  summaryItems: unknown;
  sections: unknown;
  changeSummary: string;
  noticeClass: LegalNoticeClass;
  consentRequired: boolean;
  proposedEffectiveDate: Date;
  appliesUntil: Date | null;
  status: LegalDraft['status'];
  revision: number;
  authorAccountId: string;
  createdAt: Date;
  updatedAt: Date;
}

export const VERSION_SELECT = {
  id: true,
  kind: true,
  version: true,
  title: true,
  contentSchemaVersion: true,
  summaryItems: true,
  sections: true,
  changeSummary: true,
  noticeClass: true,
  consentRequired: true,
  effectiveDate: true,
  appliesUntil: true,
  contentDigest: true,
  publishedAt: true,
  withdrawnAt: true,
  requestedByAccountId: true,
  approvedByAccountId: true,
  selfApproved: true,
} as const;

export interface VersionRow {
  id: string;
  kind: LegalDocumentKind;
  version: string;
  title: string;
  contentSchemaVersion: number;
  summaryItems: unknown;
  sections: unknown;
  changeSummary: string;
  noticeClass: LegalNoticeClass;
  consentRequired: boolean;
  effectiveDate: Date;
  appliesUntil: Date | null;
  contentDigest: string;
  publishedAt: Date;
  withdrawnAt: Date | null;
  requestedByAccountId: string | null;
  approvedByAccountId: string | null;
  selfApproved: boolean;
}

export const REQUEST_SELECT = {
  id: true,
  kind: true,
  status: true,
  contentDigest: true,
  targetLegalDraftId: true,
  targetLegalVersionId: true,
  requestedByAccountId: true,
  requestReason: true,
  expiresAt: true,
  decidedByAccountId: true,
  closedAt: true,
  decisionReason: true,
  selfApproved: true,
  createdAt: true,
} as const;

export interface RequestRow {
  id: string;
  kind: string;
  status: string;
  contentDigest: string;
  targetLegalDraftId: string | null;
  targetLegalVersionId: string | null;
  requestedByAccountId: string;
  requestReason: string | null;
  expiresAt: Date;
  decidedByAccountId: string | null;
  closedAt: Date | null;
  decisionReason: string | null;
  selfApproved: boolean;
  createdAt: Date;
}

/** Legal requests share the approval table with role requests; this path reads only these kinds. */
export const LEGAL_REQUEST_KINDS: Prisma.EnumAdminApprovalRequestKindFilter = {
  in: ['LEGAL_PUBLISH', 'LEGAL_WITHDRAW'],
};

/** sha256 of the shared fixed-order input, the same value the seed and the import export compute. */
export function legalDigest(content: LegalDraftContent): string {
  return createHash('sha256')
    .update(
      legalContentDigestInput({
        kind: content.kind,
        contentSchemaVersion: content.contentSchemaVersion,
        title: content.title,
        summaryItems: content.summaryItems,
        sections: content.sections,
        changeSummary: content.changeSummary,
        effectiveDate: content.proposedEffectiveDate,
        appliesUntil: content.appliesUntil,
        noticeClass: content.noticeClass,
        consentRequired: content.consentRequired,
      }),
    )
    .digest('hex');
}

/** The parsed import body as a draft stores it. */
export function contentOfImport(draft: LegalDocumentDraftImport): LegalDraftContent {
  return {
    kind: draft.kind,
    contentSchemaVersion: draft.contentSchemaVersion,
    title: draft.title,
    summaryItems: draft.summaryItems,
    sections: draft.sections,
    changeSummary: draft.changeSummary,
    noticeClass: draft.noticeClass,
    consentRequired: draft.consentRequired,
    proposedEffectiveDate: draft.proposedEffectiveDate,
    appliesUntil: draft.appliesUntil ?? null,
  };
}

/**
 * A stored draft read back through the shared import schema, so a row that no longer passes it (a
 * schema change, a hand edit) is never published. Returns null when it does not pass.
 */
export function parseDraftContent(row: DraftRow): LegalDraftContent | null {
  const parsed = legalDocumentDraftImportSchema.safeParse({
    kind: row.kind,
    contentSchemaVersion: row.contentSchemaVersion,
    title: row.title,
    summaryItems: row.summaryItems,
    sections: row.sections,
    changeSummary: row.changeSummary,
    noticeClass: row.noticeClass,
    consentRequired: row.consentRequired,
    proposedEffectiveDate: toVersionKey(row.proposedEffectiveDate),
    ...(row.appliesUntil ? { appliesUntil: toVersionKey(row.appliesUntil) } : {}),
  });
  return parsed.success ? contentOfImport(parsed.data) : null;
}

export function draftColumns(content: LegalDraftContent) {
  return {
    kind: content.kind,
    title: content.title,
    contentSchemaVersion: content.contentSchemaVersion,
    summaryItems: content.summaryItems,
    sections: content.sections,
    changeSummary: content.changeSummary,
    noticeClass: content.noticeClass,
    consentRequired: content.consentRequired,
    proposedEffectiveDate: fromVersionKey(content.proposedEffectiveDate),
    appliesUntil: content.appliesUntil ? fromVersionKey(content.appliesUntil) : null,
  };
}

/**
 * A draft as the API shows it. A draft whose publish request expired stays waiting in the table until
 * the next save, request or decision returns it to editing (Owner 2026-11-25 L2b Q1); reads show it as
 * editing already, as the role request list shows an expired request (README §4).
 */
export function serializeDraft(row: DraftRow, waitingRequestOpen: boolean): LegalDraft {
  const content = parseDraftContent(row);
  if (!content) {
    throw new BackofficeApiError('internal_error', 'a stored legal draft fails the import schema');
  }
  return {
    id: row.id,
    kind: row.kind,
    status: row.status === 'PENDING_APPROVAL' && !waitingRequestOpen ? 'EDITING' : row.status,
    revision: row.revision,
    basedOnVersionId: row.basedOnVersionId,
    authorAccountId: row.authorAccountId,
    content,
    contentDigest: legalDigest(content),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeVersion(row: VersionRow): LegalBackofficeVersion {
  return {
    id: row.id,
    kind: row.kind,
    version: row.version,
    title: row.title,
    changeSummary: row.changeSummary,
    noticeClass: row.noticeClass,
    consentRequired: row.consentRequired,
    effectiveDate: toVersionKey(row.effectiveDate),
    appliesUntil: row.appliesUntil ? toVersionKey(row.appliesUntil) : null,
    contentDigest: row.contentDigest,
    publishedAt: row.publishedAt.toISOString(),
    withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
    requestedByAccountId: row.requestedByAccountId,
    approvedByAccountId: row.approvedByAccountId,
    selfApproved: row.selfApproved,
  };
}

export function serializeVersionDetail(row: VersionRow): LegalBackofficeVersionDetail {
  return {
    ...serializeVersion(row),
    contentSchemaVersion: row.contentSchemaVersion,
    summaryItems: row.summaryItems as string[],
    sections: row.sections as LegalBackofficeVersionDetail['sections'],
  };
}

/** A pending request past its expiry shows as EXPIRED before anyone tries to decide it (README §4). */
export function serializeRequest(row: RequestRow, now: Date): LegalRequest {
  const expired = row.status === 'PENDING' && row.expiresAt.getTime() <= now.getTime();
  return {
    ...row,
    kind: row.kind as LegalRequest['kind'],
    status: (expired ? 'EXPIRED' : row.status) as LegalRequest['status'],
    expiresAt: row.expiresAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function versionFact(row: {
  id: string;
  noticeClass: LegalNoticeClass;
  effectiveDate: Date;
  appliesUntil: Date | null;
  withdrawnAt: Date | null;
}): LegalPublishedVersionFact {
  return {
    id: row.id,
    noticeClass: row.noticeClass,
    effectiveDate: toVersionKey(row.effectiveDate),
    appliesUntil: row.appliesUntil ? toVersionKey(row.appliesUntil) : null,
    withdrawnAt: row.withdrawnAt,
  };
}

/** The transaction's database time (CURRENT_TIMESTAMP), the clock publication facts use (D-LC2). */
export async function transactionNow(tx: BackofficeTransaction): Promise<Date> {
  const [row] = await tx.$queryRawTyped(getCurrentTimestamp());
  if (typeof row?.epochSeconds !== 'number' || !Number.isFinite(row.epochSeconds)) {
    throw new Error('database clock is unavailable');
  }
  return new Date(row.epochSeconds * 1_000);
}

/** Members who can still receive mail, from the one view backoffice_runtime reads (D-LC8). */
export async function noticeRecipientCount(tx: BackofficeTransaction): Promise<number> {
  const [row] = await tx.$queryRawTyped(countLegalNoticeRecipients());
  if (typeof row?.recipientCount !== 'number') {
    throw new Error('legal notice recipient count is unavailable');
  }
  return row.recipientCount;
}

export async function kindVersions(
  tx: BackofficeTransaction,
  kind: LegalDocumentKind,
): Promise<VersionRow[]> {
  return await tx.legalDocumentVersion.findMany({
    where: { kind },
    orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
    select: VERSION_SELECT,
  });
}

/** The live version that a draft or version of `effectiveDate` follows: the one just before it. */
export function previousVersionOf(
  versions: readonly VersionRow[],
  effectiveDate: LegalVersionKey,
): VersionRow | null {
  return (
    versions.find(
      (version) =>
        version.withdrawnAt === null && toVersionKey(version.effectiveDate) < effectiveDate,
    ) ?? null
  );
}

export const isScheduled = (row: VersionRow, now: Date) =>
  legalEffectiveInstant(toVersionKey(row.effectiveDate)).getTime() > now.getTime();
