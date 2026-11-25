import { randomUUID } from 'node:crypto';
import { Prisma } from '@repo/database/client';
import { acquireTransactionAdvisoryLock } from '@repo/database/sql';
import type {
  LegalDecisionCheck,
  LegalDraftContent,
  LegalRequestApproveRequest,
  LegalVersionState,
  LegalRequestListQuery,
  LegalRequestRejectRequest,
  LegalWithdrawRequestCreate,
} from '@repo/shared/backoffice';
import { compareLegalSections, type LegalDocumentSection } from '@repo/shared/legal';
import {
  APPROVAL_REQUEST_TTL_MS,
  decideApproval,
} from '../access-control/approval/approval-policy.js';
import { effectiveStatusFilter } from '../access-control/approval/approval-requests.service.js';
import { LEGAL_APPROVER_ROLES } from '../access-control/permissions.js';
import type { RoleAssignmentStore } from '../access-control/roles/role-assignment.store.js';
import { adminActor, type AdminAuditWriter } from '../audit/admin-audit-writer.js';
import type {
  BackofficeRuntimePrisma,
  BackofficeTransaction,
} from '../platform/database/backoffice-prisma.js';
import { BackofficeApiError } from '../platform/http/api-error.js';
import { nextPageAfter, pageCursor } from '../platform/http/keyset-page.js';
import type { AdminRequestSession } from '../platform/http/request-context.js';
import type {
  BackofficeMetrics,
  LegalDecision,
} from '../platform/observability/backoffice-metrics.js';
import { addMs, type Clock } from '../platform/time/clock.js';
import { checkLegalPublication, checkLegalWithdrawal } from './legal-publication-policy.js';
import {
  DRAFT_SELECT,
  LEGAL_REQUEST_KINDS,
  REQUEST_SELECT,
  VERSION_FACT_SELECT,
  VERSION_SELECT,
  fromVersionKey,
  isOpenRequest,
  isScheduled,
  kindVersions,
  legalDigest,
  noticeRecipientCount,
  parseDraftContent,
  previousVersionOf,
  serializeDraft,
  serializeRequest,
  serializeVersion,
  serializeVersionDetail,
  toVersionKey,
  transactionNow,
  versionFact,
  versionSections,
  type DraftRow,
  type RequestRow,
  type VersionFactRow,
  type VersionRow,
} from './legal-records.js';
import { expireLegalRequests } from './legal-request-expiry.js';

/**
 * Legal publish and withdraw requests and their decisions. An approval runs
 * in one serializable transaction under a per-kind advisory lock: the request's conditional UPDATE,
 * the decision checks, the version INSERT or the withdrawal UPDATE, the draft status and the audit row
 * all commit together or not at all; a rejection writes the request, the draft and the audit row the
 * same way without the lock. Publication facts (notice start, withdrawal time, the KST approval date)
 * use the database clock that public reading also uses; request expiry uses the app clock like the
 * role requests.
 */
export class LegalRequestsService {
  constructor(
    private readonly prisma: BackofficeRuntimePrisma,
    private readonly audit: AdminAuditWriter,
    private readonly roles: RoleAssignmentStore,
    private readonly metrics: BackofficeMetrics,
    private readonly clock: Clock,
  ) {}

  /** Every kind's versions, newest effective date first, with their state as of the database clock. */
  async documents() {
    const now = await this.prisma.databaseNow();
    const rows = (await this.prisma.legalDocumentVersion.findMany({
      orderBy: [{ kind: 'asc' }, { effectiveDate: 'desc' }, { id: 'desc' }],
      select: VERSION_FACT_SELECT,
    })) as VersionFactRow[];
    const kinds = [...new Set(rows.map((row) => row.kind))];
    return {
      documents: kinds.map((kind) => {
        const versions = rows.filter((row) => row.kind === kind);
        // Newest first, so the first live non-historical version in effect is the current one.
        const current = versions.find(
          (row) =>
            row.withdrawnAt === null && row.noticeClass !== 'HISTORICAL' && !isScheduled(row, now),
        );
        return {
          kind,
          versions: versions.map((row) => ({
            ...serializeVersion(row),
            state: versionState(row, current, now),
          })),
        };
      }),
    };
  }

  async version(versionId: string) {
    const row = (await this.prisma.legalDocumentVersion.findUnique({
      where: { id: versionId },
      select: VERSION_SELECT,
    })) as VersionRow | null;
    if (!row) {
      throw new BackofficeApiError('not_found');
    }
    return serializeVersionDetail(row);
  }

  async list(query: LegalRequestListQuery) {
    const now = this.clock.now();
    const cursor = pageCursor(query);
    const rows = (await this.prisma.adminApprovalRequest.findMany({
      where: {
        kind: query.kind ?? LEGAL_REQUEST_KINDS,
        AND: [
          effectiveStatusFilter(query.status, now),
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
      select: REQUEST_SELECT,
    })) as RequestRow[];
    return {
      requests: rows.map((row) => serializeRequest(row, now)),
      nextPage: nextPageAfter(rows, query.limit, (row) => row.createdAt),
    };
  }

  /**
   * Approval screen data: the draft or version, the comparison and, while the request can still be
   * decided, the checks as of now. A closed request shows its target as it is now and no check; the
   * two digests tell whether the draft changed since the request.
   */
  async detail(approvalRequestId: string) {
    const now = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const request = await this.findRequest(tx, approvalRequestId);
      const open = isOpenRequest(request, now);
      const databaseNow = await transactionNow(tx);
      if (request.kind === 'LEGAL_PUBLISH') {
        const draft = await this.findDraft(tx, request.targetLegalDraftId);
        const content = parseDraftContent(draft);
        const versions = await kindVersions(tx, draft.kind);
        const previous = content
          ? previousVersionOf(versions, content.proposedEffectiveDate)
          : null;
        // The draft may wait on a later request than this one.
        const waiting = await tx.adminApprovalRequest.count({
          where: {
            kind: 'LEGAL_PUBLISH',
            status: 'PENDING',
            expiresAt: { gt: now },
            targetLegalDraftId: draft.id,
          },
        });
        return {
          request: serializeRequest(request, now),
          draft: serializeDraft(draft, waiting > 0),
          version: null,
          previousVersion: previous ? serializeVersion(previous) : null,
          comparison: content
            ? compareLegalSections(
                previous ? await versionSections(tx, previous.id) : null,
                content.sections,
              )
            : [],
          check:
            open && content
              ? await this.publicationCheck(tx, content, versions, databaseNow)
              : null,
        };
      }
      const version = await this.findVersion(tx, request.targetLegalVersionId);
      const previous = previousVersionOf(
        await kindVersions(tx, version.kind),
        toVersionKey(version.effectiveDate),
      );
      return {
        request: serializeRequest(request, now),
        draft: null,
        version: serializeVersionDetail(version),
        previousVersion: previous ? serializeVersion(previous) : null,
        comparison: compareLegalSections(
          previous ? await versionSections(tx, previous.id) : null,
          version.sections as LegalDocumentSection[],
        ),
        check: open
          ? checkLegalWithdrawal({ version: versionFact(version), now: databaseNow })
          : null,
      };
    });
  }

  /** A withdrawal names a scheduled general or significant version; its digest is that version's. */
  async requestWithdraw(
    session: AdminRequestSession,
    versionId: string,
    input: LegalWithdrawRequestCreate,
    requestId: string,
  ) {
    const now = this.clock.now();
    const row = await this.prisma.serializable(async (tx) => {
      const version = await this.findVersion(tx, versionId);
      const check = checkLegalWithdrawal({
        version: versionFact(version),
        now: await transactionNow(tx),
      });
      if (!check.ok) {
        throw new BackofficeApiError('conflict', check.reason);
      }
      const duplicate = await tx.adminApprovalRequest.findFirst({
        where: {
          kind: 'LEGAL_WITHDRAW',
          status: 'PENDING',
          expiresAt: { gt: now },
          targetLegalVersionId: versionId,
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new BackofficeApiError('conflict', 'a withdrawal of this version is already pending');
      }
      const created = (await tx.adminApprovalRequest.create({
        data: {
          kind: 'LEGAL_WITHDRAW',
          contentDigest: version.contentDigest,
          targetLegalVersionId: versionId,
          requestedByAccountId: session.accountId,
          requestReason: input.reason ?? null,
          expiresAt: addMs(now, APPROVAL_REQUEST_TTL_MS),
        },
        select: REQUEST_SELECT,
      })) as RequestRow;
      await this.audit.record(tx, {
        ...adminActor({ ...session, requestId }),
        action: 'LEGAL_WITHDRAW_REQUEST',
        targetType: 'LEGAL_DOCUMENT_VERSION',
        targetId: versionId,
        approvalRequestId: created.id,
        result: 'SUCCEEDED',
        reason: input.reason ?? null,
        metadata: { kind: version.kind, noticeClass: version.noticeClass },
      });
      return created;
    });
    return serializeRequest(row, now);
  }

  async approve(
    session: AdminRequestSession,
    requestId: string,
    approvalRequestId: string,
    input: LegalRequestApproveRequest,
  ) {
    const now = this.clock.now();
    await expireLegalRequests(this.prisma, { requestId: approvalRequestId }, now);
    const outcome = await this.prisma.serializable(async (tx) => {
      const request = await this.loadPending(tx, approvalRequestId, input.contentDigest, now);
      const kind = await this.lockKind(tx, request);
      const decision = decideApproval({
        decision: 'approve',
        requesterId: request.requestedByAccountId,
        deciderId: session.accountId,
        activeApproverIds: await this.roles.activeApprovers(tx, LEGAL_APPROVER_ROLES),
        reason: input.reason,
      });
      if (!decision.allowed) {
        throw new BackofficeApiError(
          decision.reason === 'reason_required' ? 'invalid_request' : 'permission_denied',
          decision.reason,
        );
      }
      const databaseNow = await transactionNow(tx);
      const decided = await tx.adminApprovalRequest.updateMany({
        where: { id: request.id, status: 'PENDING', contentDigest: input.contentDigest },
        data: {
          status: 'APPROVED',
          decidedByAccountId: session.accountId,
          closedAt: now,
          decisionReason: input.reason ?? null,
          selfApproved: decision.selfApproved,
        },
      });
      if (decided.count !== 1) {
        throw new BackofficeApiError('conflict', 'the request was already decided');
      }
      const actor = adminActor({ ...session, requestId });
      const version =
        request.kind === 'LEGAL_PUBLISH'
          ? await this.publish(tx, request, session.accountId, decision.selfApproved, databaseNow)
          : await this.withdraw(tx, request, databaseNow);
      await this.audit.record(tx, {
        ...actor,
        action:
          request.kind === 'LEGAL_PUBLISH' ? 'LEGAL_PUBLISH_APPROVE' : 'LEGAL_WITHDRAW_APPROVE',
        targetType: 'LEGAL_DOCUMENT_VERSION',
        targetId: version.id,
        approvalRequestId: request.id,
        result: 'SUCCEEDED',
        selfApproved: decision.selfApproved,
        reason: input.reason ?? null,
        metadata: {
          kind,
          noticeClass: version.noticeClass,
          effectiveDate: toVersionKey(version.effectiveDate),
          draftId: request.targetLegalDraftId,
        },
      });
      const metric: LegalDecision =
        request.kind === 'LEGAL_PUBLISH' ? 'publish_approved' : 'withdraw_approved';
      return {
        request: await this.findRequest(tx, request.id),
        version,
        selfApproved: decision.selfApproved,
        decision: metric,
      };
    });
    this.metrics.legalDecision(outcome.version.kind, outcome.version.noticeClass, outcome.decision);
    if (outcome.selfApproved) {
      this.metrics.securityEvent('self_approval');
    }
    return {
      request: serializeRequest(outcome.request, now),
      version: serializeVersion(outcome.version),
    };
  }

  async reject(
    session: AdminRequestSession,
    requestId: string,
    approvalRequestId: string,
    input: LegalRequestRejectRequest,
  ) {
    const now = this.clock.now();
    await expireLegalRequests(this.prisma, { requestId: approvalRequestId }, now);
    const outcome = await this.prisma.serializable(async (tx) => {
      const request = await this.loadPending(tx, approvalRequestId, input.contentDigest, now);
      const decision = decideApproval({
        decision: 'reject',
        requesterId: request.requestedByAccountId,
        deciderId: session.accountId,
        activeApproverIds: [],
        reason: input.reason,
      });
      if (!decision.allowed) {
        throw new BackofficeApiError('permission_denied', decision.reason);
      }
      const decided = await tx.adminApprovalRequest.updateMany({
        where: { id: request.id, status: 'PENDING', contentDigest: input.contentDigest },
        data: {
          status: 'REJECTED',
          decidedByAccountId: session.accountId,
          closedAt: now,
          decisionReason: input.reason,
        },
      });
      if (decided.count !== 1) {
        throw new BackofficeApiError('conflict', 'the request was already decided');
      }
      const target = await this.releaseTarget(tx, request);
      await this.audit.record(tx, {
        ...adminActor({ ...session, requestId }),
        action: request.kind === 'LEGAL_PUBLISH' ? 'LEGAL_PUBLISH_REJECT' : 'LEGAL_WITHDRAW_REJECT',
        targetType:
          request.kind === 'LEGAL_PUBLISH' ? 'LEGAL_DOCUMENT_DRAFT' : 'LEGAL_DOCUMENT_VERSION',
        targetId: target.id,
        approvalRequestId: request.id,
        result: 'SUCCEEDED',
        reason: input.reason,
        metadata: { kind: target.kind, noticeClass: target.noticeClass },
      });
      return { request: await this.findRequest(tx, request.id), target };
    });
    this.metrics.legalDecision(
      outcome.target.kind,
      outcome.target.noticeClass,
      outcome.request.kind === 'LEGAL_PUBLISH' ? 'publish_rejected' : 'withdraw_rejected',
    );
    return { request: serializeRequest(outcome.request, now), version: null };
  }

  /** The requester cancels their own request; a cancelled publish request returns its draft to editing. */
  async cancel(session: AdminRequestSession, requestId: string, approvalRequestId: string) {
    const now = this.clock.now();
    const row = await this.prisma.$transaction(async (tx) => {
      const request = await this.findRequest(tx, approvalRequestId);
      const cancelled = await tx.adminApprovalRequest.updateMany({
        where: {
          id: approvalRequestId,
          kind: LEGAL_REQUEST_KINDS,
          status: 'PENDING',
          requestedByAccountId: session.accountId,
        },
        data: { status: 'CANCELLED', closedAt: now },
      });
      if (cancelled.count !== 1) {
        throw new BackofficeApiError('not_found');
      }
      const target = await this.releaseTarget(tx, request);
      await this.audit.record(tx, {
        ...adminActor({ ...session, requestId }),
        action: 'LEGAL_REQUEST_CANCEL',
        targetType:
          request.kind === 'LEGAL_PUBLISH' ? 'LEGAL_DOCUMENT_DRAFT' : 'LEGAL_DOCUMENT_VERSION',
        targetId: target.id,
        approvalRequestId,
        result: 'SUCCEEDED',
        metadata: { kind: target.kind },
      });
      return this.findRequest(tx, approvalRequestId);
    });
    return serializeRequest(row, now);
  }

  /** The checks a publish decision runs, as of `now` (the transaction's database time). */
  private async publicationCheck(
    tx: BackofficeTransaction,
    content: LegalDraftContent,
    versions: readonly VersionFactRow[],
    now: Date,
  ): Promise<LegalDecisionCheck> {
    return checkLegalPublication({
      candidate: {
        kind: content.kind,
        noticeClass: content.noticeClass,
        consentRequired: content.consentRequired,
        effectiveDate: content.proposedEffectiveDate,
        appliesUntil: content.appliesUntil,
      },
      versions: versions.map(versionFact),
      now,
      recipientCount: await noticeRecipientCount(tx),
    });
  }

  private async publish(
    tx: BackofficeTransaction,
    request: RequestRow,
    approverId: string,
    selfApproved: boolean,
    now: Date,
  ): Promise<VersionRow> {
    const draft = await this.findDraft(tx, request.targetLegalDraftId);
    const content = parseDraftContent(draft);
    if (!content) {
      throw new BackofficeApiError('conflict', 'the draft no longer passes the import schema');
    }
    if (draft.status !== 'PENDING_APPROVAL') {
      throw new BackofficeApiError('conflict', 'the draft is not waiting for approval');
    }
    if (legalDigest(content) !== request.contentDigest) {
      throw new BackofficeApiError('conflict', 'the draft content changed after the request');
    }
    const check = await this.publicationCheck(
      tx,
      content,
      await kindVersions(tx, content.kind),
      now,
    );
    if (!check.ok) {
      throw new BackofficeApiError('conflict', check.reason);
    }
    const id = randomUUID();
    let version: VersionRow;
    try {
      version = await tx.legalDocumentVersion.create({
        data: {
          id,
          kind: content.kind,
          version: `backoffice-${content.proposedEffectiveDate}-${id.slice(0, 8)}`,
          title: content.title,
          contentSchemaVersion: content.contentSchemaVersion,
          summaryItems: content.summaryItems,
          sections: content.sections,
          changeSummary: content.changeSummary,
          noticeClass: content.noticeClass,
          consentRequired: content.consentRequired,
          effectiveDate: fromVersionKey(content.proposedEffectiveDate),
          appliesUntil:
            content.noticeClass === 'HISTORICAL' && content.appliesUntil
              ? fromVersionKey(content.appliesUntil)
              : null,
          contentDigest: request.contentDigest,
          publishedAt: now,
          requestedByAccountId: request.requestedByAccountId,
          approvedByAccountId: approverId,
          selfApproved,
        },
        select: VERSION_SELECT,
      });
    } catch (error) {
      // The partial unique indexes are the last guard for (kind, date) and one first publication.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BackofficeApiError('conflict', 'a version of that kind already takes that place');
      }
      throw error;
    }
    const published = await tx.legalDocumentDraft.updateMany({
      where: { id: draft.id, status: 'PENDING_APPROVAL' },
      data: { status: 'PUBLISHED' },
    });
    if (published.count !== 1) {
      throw new BackofficeApiError('conflict', 'the draft is not waiting for approval');
    }
    return version;
  }

  /** Writes the withdrawal time once: a version already withdrawn matches no row. */
  private async withdraw(
    tx: BackofficeTransaction,
    request: RequestRow,
    now: Date,
  ): Promise<VersionRow> {
    const version = await this.findVersion(tx, request.targetLegalVersionId);
    if (version.contentDigest !== request.contentDigest) {
      throw new BackofficeApiError('conflict', 'the version is not the one requested');
    }
    // The class and effective time are checked here; whether it is already withdrawn is left to the
    // conditional UPDATE, so a second approval finds no row and the first withdrawal time stays.
    const check = checkLegalWithdrawal({
      version: { ...versionFact(version), withdrawnAt: null },
      now,
    });
    if (!check.ok) {
      throw new BackofficeApiError('conflict', check.reason);
    }
    const withdrawn = await tx.legalDocumentVersion.updateMany({
      where: { id: version.id, withdrawnAt: null },
      data: { withdrawnAt: now },
    });
    if (withdrawn.count !== 1) {
      throw new BackofficeApiError('conflict', 'already_withdrawn');
    }
    return this.findVersion(tx, version.id);
  }

  /** A closed publish request returns its draft to editing; a withdrawal leaves the version as it is. */
  private async releaseTarget(tx: BackofficeTransaction, request: RequestRow) {
    if (request.kind === 'LEGAL_PUBLISH') {
      const draft = await this.findDraft(tx, request.targetLegalDraftId);
      await tx.legalDocumentDraft.updateMany({
        where: { id: draft.id, status: 'PENDING_APPROVAL' },
        data: { status: 'EDITING' },
      });
      return { id: draft.id, kind: draft.kind, noticeClass: draft.noticeClass };
    }
    const version = await this.findVersion(tx, request.targetLegalVersionId);
    return { id: version.id, kind: version.kind, noticeClass: version.noticeClass };
  }

  /**
   * Approvals of one document kind run one at a time. The serializable snapshot is taken by the first
   * read, before this lock, so an approval that waited still reads the kind as it was; its
   * serialization conflict with the approval that committed first makes `serializable()` run it again
   * on a fresh snapshot, whose checks then see that approval.
   */
  private async lockKind(tx: BackofficeTransaction, request: RequestRow) {
    const kind =
      request.kind === 'LEGAL_PUBLISH'
        ? (await this.findDraft(tx, request.targetLegalDraftId)).kind
        : (await this.findVersion(tx, request.targetLegalVersionId)).kind;
    await tx.$queryRawTyped(acquireTransactionAdvisoryLock('legal_document_kind', kind));
    return kind;
  }

  /**
   * A pending legal request past its expiry was closed as EXPIRED, and its draft returned to editing,
   * just before the decision's transaction (so no transaction waits on another connection); the
   * decision then gets a conflict. Another digest is a conflict too.
   */
  private async loadPending(
    tx: BackofficeTransaction,
    approvalRequestId: string,
    contentDigest: string,
    now: Date,
  ): Promise<RequestRow> {
    const request = await this.findRequest(tx, approvalRequestId);
    if (request.status !== 'PENDING') {
      throw new BackofficeApiError('conflict', 'the request is closed');
    }
    if (request.expiresAt.getTime() <= now.getTime()) {
      throw new BackofficeApiError('conflict', 'the request expired');
    }
    if (request.contentDigest !== contentDigest) {
      throw new BackofficeApiError('conflict', 'the request content changed');
    }
    const requester = await tx.adminAccount.findUnique({
      where: { id: request.requestedByAccountId },
      select: { status: true },
    });
    if (requester?.status !== 'ACTIVE') {
      throw new BackofficeApiError('conflict', 'the requester is not active');
    }
    return request;
  }

  private async findRequest(tx: BackofficeTransaction, approvalRequestId: string) {
    const row = (await tx.adminApprovalRequest.findFirst({
      where: { id: approvalRequestId, kind: LEGAL_REQUEST_KINDS },
      select: REQUEST_SELECT,
    })) as RequestRow | null;
    if (!row) {
      throw new BackofficeApiError('not_found');
    }
    return row;
  }

  private async findDraft(tx: BackofficeTransaction, draftId: string | null): Promise<DraftRow> {
    const row = draftId
      ? ((await tx.legalDocumentDraft.findUnique({
          where: { id: draftId },
          select: DRAFT_SELECT,
        })) as DraftRow | null)
      : null;
    if (!row) {
      throw new BackofficeApiError('not_found');
    }
    return row;
  }

  private async findVersion(
    tx: BackofficeTransaction,
    versionId: string | null,
  ): Promise<VersionRow> {
    const row = versionId
      ? ((await tx.legalDocumentVersion.findUnique({
          where: { id: versionId },
          select: VERSION_SELECT,
        })) as VersionRow | null)
      : null;
    if (!row) {
      throw new BackofficeApiError('not_found');
    }
    return row;
  }
}

function versionState(
  row: VersionFactRow,
  current: VersionFactRow | undefined,
  now: Date,
): LegalVersionState {
  if (row.withdrawnAt !== null) {
    return 'withdrawn';
  }
  if (isScheduled(row, now)) {
    return 'scheduled';
  }
  return row.id === current?.id ? 'current' : 'previous';
}
