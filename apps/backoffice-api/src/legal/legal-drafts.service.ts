import type { Prisma } from '@repo/database/client';
import type {
  LegalDraftCreateRequest,
  LegalDraftDiscardRequest,
  LegalDraftListQuery,
  LegalDraftUpdateRequest,
  LegalPublishRequestCreate,
} from '@repo/shared/backoffice';
import { compareLegalSections, type LegalVersionKey } from '@repo/shared/legal';
import { APPROVAL_REQUEST_TTL_MS } from '../access-control/approval/approval-policy.js';
import { adminActor, type AdminAuditWriter } from '../audit/admin-audit-writer.js';
import type {
  BackofficeRuntimePrisma,
  BackofficeTransaction,
} from '../platform/database/backoffice-prisma.js';
import { BackofficeApiError } from '../platform/http/api-error.js';
import { nextPageAfter, pageCursor } from '../platform/http/keyset-page.js';
import type { AdminRequestSession } from '../platform/http/request-context.js';
import { addMs, type Clock } from '../platform/time/clock.js';
import {
  DRAFT_SELECT,
  REQUEST_SELECT,
  contentOfImport,
  draftColumns,
  kindVersions,
  legalDigest,
  parseDraftContent,
  previousVersionOf,
  serializeDraft,
  serializeRequest,
  serializeVersion,
  versionSections,
  type DraftRow,
  type RequestRow,
} from './legal-records.js';
import { expireLegalRequests } from './legal-request-expiry.js';

const openPublishRequest = (now: Date): Prisma.AdminApprovalRequestWhereInput => ({
  kind: 'LEGAL_PUBLISH',
  status: 'PENDING',
  expiresAt: { gt: now },
});

/**
 * Filters by the status a draft shows: a draft whose publish request expired stays waiting in the
 * table until the next save, request or decision, and reads as editing before that (README §8).
 */
function draftStatusFilter(
  status: LegalDraftListQuery['status'],
  now: Date,
): Prisma.LegalDocumentDraftWhereInput {
  if (status === 'EDITING') {
    return {
      OR: [
        { status: 'EDITING' },
        { status: 'PENDING_APPROVAL', publishRequests: { none: openPublishRequest(now) } },
      ],
    };
  }
  if (status === 'PENDING_APPROVAL') {
    return { status: 'PENDING_APPROVAL', publishRequests: { some: openPublishRequest(now) } };
  }
  return status ? { status } : {};
}

/** The live version a draft of that kind and date follows, stored as the draft's base. */
async function basedOnVersionId(
  tx: BackofficeTransaction,
  kind: LegalDraftCreateRequest['draft']['kind'],
  effectiveDate: LegalVersionKey,
): Promise<string | null> {
  return previousVersionOf(await kindVersions(tx, kind), effectiveDate)?.id ?? null;
}

/**
 * Legal drafts: created from the editor or a JSON file through the shared
 * import schema, saved with a conditional UPDATE on the revision, and frozen while a publish request
 * waits. Drafts hold no user personal data.
 */
export class LegalDraftsService {
  constructor(
    private readonly prisma: BackofficeRuntimePrisma,
    private readonly audit: AdminAuditWriter,
    private readonly clock: Clock,
  ) {}

  /** Newest created first: the creation time does not move when a draft is saved between pages. */
  async list(query: LegalDraftListQuery) {
    const cursor = pageCursor(query);
    const rows = (await this.prisma.legalDocumentDraft.findMany({
      where: {
        ...(query.kind ? { kind: query.kind } : {}),
        AND: [
          draftStatusFilter(query.status, this.clock.now()),
          cursor
            ? {
                createdAt: { lte: cursor.time },
                OR: [
                  { createdAt: { lt: cursor.time } },
                  { createdAt: cursor.time, id: { lt: cursor.id } },
                ],
              }
            : {},
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
      select: DRAFT_SELECT,
    })) as DraftRow[];
    const open = await this.openRequestDrafts(rows.map((row) => row.id));
    return {
      drafts: rows.map((row) => serializeDraft(row, open.has(row.id))),
      nextPage: nextPageAfter(rows, query.limit, (row) => row.createdAt),
    };
  }

  /** Preview data: the draft, the live version just before it and the article comparison. */
  async detail(draftId: string) {
    const row = await this.findDraft(this.prisma, draftId);
    const draft = serializeDraft(row, (await this.openRequestDrafts([row.id])).has(row.id));
    const previous = previousVersionOf(
      await kindVersions(this.prisma, row.kind),
      draft.content.proposedEffectiveDate,
    );
    return {
      draft,
      previousVersion: previous ? serializeVersion(previous) : null,
      comparison: compareLegalSections(
        previous ? await versionSections(this.prisma, previous.id) : null,
        draft.content.sections,
      ),
    };
  }

  async create(session: AdminRequestSession, input: LegalDraftCreateRequest, requestId: string) {
    const content = contentOfImport(input.draft);
    const row = await this.prisma.$transaction(async (tx) => {
      const created = (await tx.legalDocumentDraft.create({
        data: {
          ...draftColumns(content),
          basedOnVersionId: await basedOnVersionId(tx, content.kind, content.proposedEffectiveDate),
          authorAccountId: session.accountId,
        },
        select: DRAFT_SELECT,
      })) as DraftRow;
      await this.audit.record(tx, {
        ...adminActor({ ...session, requestId }),
        action: 'LEGAL_DRAFT_CREATE',
        targetType: 'LEGAL_DOCUMENT_DRAFT',
        targetId: created.id,
        result: 'SUCCEEDED',
        metadata: { kind: content.kind, noticeClass: content.noticeClass, source: input.source },
      });
      return created;
    });
    return serializeDraft(row, false);
  }

  /** Saves at the revision the editor read; a draft waiting for approval is not saved. */
  async update(
    session: AdminRequestSession,
    draftId: string,
    input: LegalDraftUpdateRequest,
    requestId: string,
  ) {
    await expireLegalRequests(this.prisma, { draftId }, this.clock.now());
    const content = contentOfImport(input.draft);
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await this.findDraft(tx, draftId);
      if (current.kind !== content.kind) {
        throw new BackofficeApiError('invalid_request', 'a draft keeps its document kind');
      }
      const saved = await tx.legalDocumentDraft.updateMany({
        where: { id: draftId, status: 'EDITING', revision: input.revision },
        data: {
          ...draftColumns(content),
          basedOnVersionId: await basedOnVersionId(tx, content.kind, content.proposedEffectiveDate),
          revision: { increment: 1 },
        },
      });
      if (saved.count !== 1) {
        throw new BackofficeApiError(
          'conflict',
          'the draft is waiting for approval or was saved since',
        );
      }
      await this.audit.record(tx, {
        ...adminActor({ ...session, requestId }),
        action: 'LEGAL_DRAFT_UPDATE',
        targetType: 'LEGAL_DOCUMENT_DRAFT',
        targetId: draftId,
        result: 'SUCCEEDED',
        metadata: {
          kind: content.kind,
          noticeClass: content.noticeClass,
          revision: input.revision + 1,
        },
      });
      return this.findDraft(tx, draftId);
    });
    return serializeDraft(row, false);
  }

  async discard(
    session: AdminRequestSession,
    draftId: string,
    input: LegalDraftDiscardRequest,
    requestId: string,
  ) {
    await expireLegalRequests(this.prisma, { draftId }, this.clock.now());
    const row = await this.prisma.$transaction(async (tx) => {
      const discarded = await tx.legalDocumentDraft.updateMany({
        where: { id: draftId, status: 'EDITING', revision: input.revision },
        data: { status: 'DISCARDED' },
      });
      if (discarded.count !== 1) {
        throw new BackofficeApiError(
          'conflict',
          'only an editing draft at that revision is discarded',
        );
      }
      await this.audit.record(tx, {
        ...adminActor({ ...session, requestId }),
        action: 'LEGAL_DRAFT_DISCARD',
        targetType: 'LEGAL_DOCUMENT_DRAFT',
        targetId: draftId,
        result: 'SUCCEEDED',
      });
      return this.findDraft(tx, draftId);
    });
    return serializeDraft(row, false);
  }

  /** One publish request per draft; its digest is the draft content at that revision. */
  async requestPublish(
    session: AdminRequestSession,
    draftId: string,
    input: LegalPublishRequestCreate,
    requestId: string,
  ) {
    const now = this.clock.now();
    await expireLegalRequests(this.prisma, { draftId }, now);
    const row = await this.prisma.serializable(async (tx) => {
      const draft = await this.findDraft(tx, draftId);
      const content = parseDraftContent(draft);
      if (!content) {
        throw new BackofficeApiError('conflict', 'the draft no longer passes the import schema');
      }
      const frozen = await tx.legalDocumentDraft.updateMany({
        where: { id: draftId, status: 'EDITING', revision: input.revision },
        data: { status: 'PENDING_APPROVAL' },
      });
      if (frozen.count !== 1) {
        throw new BackofficeApiError(
          'conflict',
          'the draft is waiting for approval or was saved since',
        );
      }
      const created = (await tx.adminApprovalRequest.create({
        data: {
          kind: 'LEGAL_PUBLISH',
          contentDigest: legalDigest(content),
          targetLegalDraftId: draftId,
          requestedByAccountId: session.accountId,
          requestReason: input.reason ?? null,
          expiresAt: addMs(now, APPROVAL_REQUEST_TTL_MS),
        },
        select: REQUEST_SELECT,
      })) as RequestRow;
      await this.audit.record(tx, {
        ...adminActor({ ...session, requestId }),
        action: 'LEGAL_PUBLISH_REQUEST',
        targetType: 'LEGAL_DOCUMENT_DRAFT',
        targetId: draftId,
        approvalRequestId: created.id,
        result: 'SUCCEEDED',
        reason: input.reason ?? null,
        metadata: {
          kind: content.kind,
          noticeClass: content.noticeClass,
          effectiveDate: content.proposedEffectiveDate,
        },
      });
      return created;
    });
    return serializeRequest(row, now);
  }

  private async findDraft(
    client: BackofficeRuntimePrisma | BackofficeTransaction,
    draftId: string,
  ): Promise<DraftRow> {
    const row = (await client.legalDocumentDraft.findUnique({
      where: { id: draftId },
      select: DRAFT_SELECT,
    })) as DraftRow | null;
    if (!row) {
      throw new BackofficeApiError('not_found');
    }
    return row;
  }

  /** Drafts among `draftIds` with a publish request still open (pending and not past its expiry). */
  async openRequestDrafts(draftIds: readonly string[]): Promise<Set<string>> {
    if (draftIds.length === 0) {
      return new Set();
    }
    const rows = await this.prisma.adminApprovalRequest.findMany({
      where: { ...openPublishRequest(this.clock.now()), targetLegalDraftId: { in: [...draftIds] } },
      select: { targetLegalDraftId: true },
    });
    return new Set(rows.flatMap((row) => (row.targetLegalDraftId ? [row.targetLegalDraftId] : [])));
  }
}
