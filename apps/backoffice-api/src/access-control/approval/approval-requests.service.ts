import type { Prisma } from '@repo/database/client';
import type {
  AccessRequestApproveRequest,
  AccessRequestCreateRequest,
  AccessRequestListQuery,
  AccessRequestRejectRequest,
} from '@repo/shared/backoffice';
import type { AdminSessionService } from '../../admin-identity/session/admin-session.service.js';
import { adminActor, type AdminAuditWriter } from '../../audit/admin-audit-writer.js';
import type {
  BackofficeRuntimePrisma,
  BackofficeTransaction,
} from '../../platform/database/backoffice-prisma.js';
import { BackofficeApiError } from '../../platform/http/api-error.js';
import { nextPageAfter, pageCursor } from '../../platform/http/keyset-page.js';
import type { AdminRequestSession } from '../../platform/http/request-context.js';
import type {
  BackofficeMetrics,
  SecurityEvent,
} from '../../platform/observability/backoffice-metrics.js';
import { addMs, type Clock } from '../../platform/time/clock.js';
import { ROLE_CHANGE_APPROVER_ROLES } from '../permissions.js';
import type { RoleAssignmentStore } from '../roles/role-assignment.store.js';
import {
  APPROVAL_REQUEST_TTL_MS,
  approvalContentDigest,
  decideApproval,
} from './approval-policy.js';

const REQUEST_SELECT = {
  id: true,
  kind: true,
  status: true,
  contentDigest: true,
  targetAccountId: true,
  targetRole: true,
  requestedByAccountId: true,
  requestReason: true,
  expiresAt: true,
  decidedByAccountId: true,
  closedAt: true,
  decisionReason: true,
  selfApproved: true,
  createdAt: true,
} as const;

function serializeRequest(row: {
  id: string;
  kind: string;
  status: string;
  contentDigest: string;
  targetAccountId: string | null;
  targetRole: string | null;
  requestedByAccountId: string;
  requestReason: string | null;
  expiresAt: Date;
  decidedByAccountId: string | null;
  closedAt: Date | null;
  decisionReason: string | null;
  selfApproved: boolean;
  createdAt: Date;
}) {
  return {
    ...row,
    expiresAt: row.expiresAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function effectiveStatusFilter(
  status: AccessRequestListQuery['status'],
  now: Date,
): Prisma.AdminApprovalRequestWhereInput {
  if (status === 'PENDING') {
    return { status: 'PENDING', expiresAt: { gt: now } };
  }
  if (status === 'EXPIRED') {
    return { OR: [{ status: 'EXPIRED' }, { status: 'PENDING', expiresAt: { lte: now } }] };
  }
  return status ? { status } : {};
}

/**
 * Role grant and revoke requests (OA-R9). Every change after the first owner goes through
 * one request and a decision by another account, except the single-approver case.
 */
export class ApprovalRequestsService {
  constructor(
    private readonly prisma: BackofficeRuntimePrisma,
    private readonly audit: AdminAuditWriter,
    private readonly roles: RoleAssignmentStore,
    private readonly sessions: AdminSessionService,
    private readonly metrics: BackofficeMetrics,
    private readonly clock: Clock,
  ) {}

  /**
   * Newest first, a keyset page at a time. A pending request past its expiry is closed only when
   * someone tries to decide it, so the list shows it as EXPIRED and filters it that way.
   */
  async list(query: AccessRequestListQuery) {
    const now = this.clock.now();
    const cursor = pageCursor(query);
    const rows = await this.prisma.adminApprovalRequest.findMany({
      where: {
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
    });
    return {
      requests: rows.map((row) =>
        serializeRequest(
          row.status === 'PENDING' && row.expiresAt.getTime() <= now.getTime()
            ? { ...row, status: 'EXPIRED' }
            : row,
        ),
      ),
      nextPage: nextPageAfter(rows, query.limit, (row) => row.createdAt),
    };
  }

  async create(session: AdminRequestSession, input: AccessRequestCreateRequest, requestId: string) {
    const now = this.clock.now();
    const contentDigest = approvalContentDigest(input);
    const row = await this.prisma.serializable(async (tx) => {
      const target = await tx.adminAccount.findUnique({
        where: { id: input.targetAccountId },
        select: { status: true },
      });
      if (!target || target.status !== 'ACTIVE') {
        throw new BackofficeApiError('not_found');
      }
      const held = (await this.roles.activeRoles(tx, input.targetAccountId)).includes(
        input.targetRole,
      );
      if ((input.kind === 'ROLE_GRANT') === held) {
        throw new BackofficeApiError('conflict', 'the target already has (or lacks) that role');
      }
      const duplicate = await tx.adminApprovalRequest.findFirst({
        where: { status: 'PENDING', contentDigest, expiresAt: { gt: now } },
        select: { id: true },
      });
      if (duplicate) {
        throw new BackofficeApiError('conflict', 'the same request is already pending');
      }
      const created = await tx.adminApprovalRequest.create({
        data: {
          kind: input.kind,
          contentDigest,
          targetAccountId: input.targetAccountId,
          targetRole: input.targetRole,
          requestedByAccountId: session.accountId,
          requestReason: input.reason ?? null,
          expiresAt: addMs(now, APPROVAL_REQUEST_TTL_MS),
        },
        select: REQUEST_SELECT,
      });
      await this.audit.record(tx, {
        ...adminActor({ ...session, requestId }),
        action: 'ACCESS_REQUEST_CREATE',
        targetType: 'ADMIN_APPROVAL_REQUEST',
        targetId: created.id,
        approvalRequestId: created.id,
        result: 'SUCCEEDED',
        reason: input.reason ?? null,
        metadata: { kind: input.kind, role: input.targetRole, accountId: input.targetAccountId },
      });
      return created;
    });
    return serializeRequest(row);
  }

  async approve(
    session: AdminRequestSession,
    requestId: string,
    approvalRequestId: string,
    input: AccessRequestApproveRequest,
  ) {
    const events: SecurityEvent[] = [];
    const now = this.clock.now();
    const row = await this.prisma.serializable(async (tx) => {
      events.length = 0;
      const request = await this.loadPending(tx, approvalRequestId, input.contentDigest, now);
      const approvers = await this.roles.activeRoleChangeApprovers(tx);
      const outcome = decideApproval({
        decision: 'approve',
        requesterId: request.requestedByAccountId,
        deciderId: session.accountId,
        activeApproverIds: approvers,
        reason: input.reason,
      });
      if (!outcome.allowed) {
        throw new BackofficeApiError(
          outcome.reason === 'reason_required' ? 'invalid_request' : 'permission_denied',
          outcome.reason,
        );
      }
      const targetAccountId = request.targetAccountId!;
      const targetRole = request.targetRole!;
      const target = await tx.adminAccount.findUnique({
        where: { id: targetAccountId },
        select: { status: true },
      });
      if (!target || target.status !== 'ACTIVE') {
        throw new BackofficeApiError('conflict', 'the target account is not active');
      }
      if (
        request.kind === 'ROLE_REVOKE' &&
        ROLE_CHANGE_APPROVER_ROLES.includes(targetRole) &&
        approvers.length === 1 &&
        approvers[0] === targetAccountId
      ) {
        // Revoking the last approver's role would leave no one to decide role changes.
        throw new BackofficeApiError('conflict', 'the last approver role cannot be revoked');
      }
      const decided = await tx.adminApprovalRequest.updateMany({
        where: { id: request.id, status: 'PENDING', contentDigest: input.contentDigest },
        data: {
          status: 'APPROVED',
          decidedByAccountId: session.accountId,
          closedAt: now,
          decisionReason: input.reason ?? null,
          selfApproved: outcome.selfApproved,
        },
      });
      if (decided.count !== 1) {
        throw new BackofficeApiError('conflict', 'the request was already decided');
      }
      const actor = adminActor({ ...session, requestId });
      if (request.kind === 'ROLE_GRANT') {
        const assignmentId = await this.roles.grant(tx, {
          accountId: targetAccountId,
          role: targetRole,
          approvalRequestId: request.id,
          now,
        });
        await this.audit.record(tx, {
          ...actor,
          action: 'ROLE_GRANT',
          targetType: 'ADMIN_ROLE_ASSIGNMENT',
          targetId: assignmentId,
          approvalRequestId: request.id,
          result: 'SUCCEEDED',
          metadata: { role: targetRole, accountId: targetAccountId },
        });
        events.push('role_granted');
      } else {
        const assignmentId = await this.roles.revoke(tx, {
          accountId: targetAccountId,
          role: targetRole,
          approvalRequestId: request.id,
          now,
        });
        if (!assignmentId) {
          throw new BackofficeApiError('conflict', 'the target no longer holds that role');
        }
        // Revoking a role ends the target's sessions at once (OA-R3).
        await this.sessions.revokeAllForAccount(tx, targetAccountId, 'ROLE_REVOKED', now);
        await this.audit.record(tx, {
          ...actor,
          action: 'ROLE_REVOKE',
          targetType: 'ADMIN_ROLE_ASSIGNMENT',
          targetId: assignmentId,
          approvalRequestId: request.id,
          result: 'SUCCEEDED',
          metadata: { role: targetRole, accountId: targetAccountId },
        });
        events.push('role_revoked');
      }
      await this.audit.record(tx, {
        ...actor,
        action: 'ACCESS_REQUEST_APPROVE',
        targetType: 'ADMIN_APPROVAL_REQUEST',
        targetId: request.id,
        approvalRequestId: request.id,
        result: 'SUCCEEDED',
        selfApproved: outcome.selfApproved,
        reason: input.reason ?? null,
      });
      if (outcome.selfApproved) {
        events.push('self_approval');
      }
      return tx.adminApprovalRequest.findUniqueOrThrow({
        where: { id: request.id },
        select: REQUEST_SELECT,
      });
    });
    for (const event of events) {
      this.metrics.securityEvent(event);
    }
    return serializeRequest(row);
  }

  async reject(
    session: AdminRequestSession,
    requestId: string,
    approvalRequestId: string,
    input: AccessRequestRejectRequest,
  ) {
    const now = this.clock.now();
    const row = await this.prisma.serializable(async (tx) => {
      const request = await this.loadPending(tx, approvalRequestId, input.contentDigest, now);
      const outcome = decideApproval({
        decision: 'reject',
        requesterId: request.requestedByAccountId,
        deciderId: session.accountId,
        activeApproverIds: [],
        reason: input.reason,
      });
      if (!outcome.allowed) {
        throw new BackofficeApiError('permission_denied', outcome.reason);
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
      await this.audit.record(tx, {
        ...adminActor({ ...session, requestId }),
        action: 'ACCESS_REQUEST_REJECT',
        targetType: 'ADMIN_APPROVAL_REQUEST',
        targetId: request.id,
        approvalRequestId: request.id,
        result: 'SUCCEEDED',
        reason: input.reason,
      });
      return tx.adminApprovalRequest.findUniqueOrThrow({
        where: { id: request.id },
        select: REQUEST_SELECT,
      });
    });
    return serializeRequest(row);
  }

  async cancel(session: AdminRequestSession, requestId: string, approvalRequestId: string) {
    const now = this.clock.now();
    const row = await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.adminApprovalRequest.updateMany({
        where: {
          id: approvalRequestId,
          status: 'PENDING',
          requestedByAccountId: session.accountId,
        },
        data: { status: 'CANCELLED', closedAt: now },
      });
      if (cancelled.count !== 1) {
        throw new BackofficeApiError('not_found');
      }
      await this.audit.record(tx, {
        ...adminActor({ ...session, requestId }),
        action: 'ACCESS_REQUEST_CANCEL',
        targetType: 'ADMIN_APPROVAL_REQUEST',
        targetId: approvalRequestId,
        approvalRequestId,
        result: 'SUCCEEDED',
      });
      return tx.adminApprovalRequest.findUniqueOrThrow({
        where: { id: approvalRequestId },
        select: REQUEST_SELECT,
      });
    });
    return serializeRequest(row);
  }

  /**
   * A pending request whose expiry passed is closed as EXPIRED here (no decision); the caller
   * then gets a conflict. A digest that differs from the stored one is a conflict too.
   */
  private async loadPending(
    tx: BackofficeTransaction,
    approvalRequestId: string,
    contentDigest: string,
    now: Date,
  ) {
    const request = await tx.adminApprovalRequest.findUnique({
      where: { id: approvalRequestId },
      select: REQUEST_SELECT,
    });
    if (!request) {
      throw new BackofficeApiError('not_found');
    }
    if (request.status !== 'PENDING') {
      throw new BackofficeApiError('conflict', 'the request is closed');
    }
    if (request.expiresAt.getTime() <= now.getTime()) {
      await this.expire(request.id, now);
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

  /** Runs in its own transaction so the expiry survives the caller's rollback. */
  private async expire(approvalRequestId: string, now: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.adminApprovalRequest.updateMany({
        where: { id: approvalRequestId, status: 'PENDING', expiresAt: { lte: now } },
        data: { status: 'EXPIRED', closedAt: now },
      });
    });
  }
}
