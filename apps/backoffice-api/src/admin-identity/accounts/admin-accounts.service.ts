import type { AccountDeactivateRequest, InvitationCreateRequest } from '@repo/shared/backoffice';
import type { RoleAssignmentStore } from '../../access-control/roles/role-assignment.store.js';
import { adminActor, type AdminAuditWriter } from '../../audit/admin-audit-writer.js';
import type { BackofficeRuntimePrisma } from '../../platform/database/backoffice-prisma.js';
import { BackofficeApiError } from '../../platform/http/api-error.js';
import type { AdminRequestSession } from '../../platform/http/request-context.js';
import type { BackofficeMetrics } from '../../platform/observability/backoffice-metrics.js';
import { addMs, MINUTE_MS, type Clock } from '../../platform/time/clock.js';
import { generateOpaqueToken } from '../crypto/tokens.js';
import { invitationCodeHash } from '../registration/admin-registration.service.js';
import type { AdminSessionService } from '../session/admin-session.service.js';

/** Invitation and bootstrap codes are used once within 15 minutes (OA-R10). */
export const INVITATION_TTL_MS = 15 * MINUTE_MS;

export interface IssuedInvitation {
  readonly invitationId: string;
  readonly code: string;
  readonly expiresAt: string;
}

/**
 * Operator accounts (OA-R1, OA-R6). An invitation gives no role; roles come from approval requests.
 * Deactivation ends the account's sessions and roles the same day, deletes its credentials and
 * keeps the row so audit rows still point at it.
 */
export class AdminAccountsService {
  constructor(
    private readonly prisma: BackofficeRuntimePrisma,
    private readonly audit: AdminAuditWriter,
    private readonly sessions: AdminSessionService,
    private readonly roles: RoleAssignmentStore,
    private readonly metrics: BackofficeMetrics,
    private readonly clock: Clock,
  ) {}

  async list() {
    const now = this.clock.now();
    const [accounts, invitations] = await Promise.all([
      this.prisma.adminAccount.findMany({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          email: true,
          displayName: true,
          status: true,
          lockedUntil: true,
          lastLoginAt: true,
          deactivatedAt: true,
          createdAt: true,
          roleAssignments: { where: { revokedAt: null }, select: { role: true } },
        },
      }),
      this.prisma.adminInvitation.findMany({
        where: { usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, kind: true, email: true, displayName: true, expiresAt: true },
      }),
    ]);
    return {
      accounts: accounts.map((account) => ({
        id: account.id,
        email: account.email,
        displayName: account.displayName,
        status: account.status,
        locked: account.lockedUntil !== null && account.lockedUntil > now,
        roles: account.roleAssignments.map((assignment) => assignment.role),
        lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
        deactivatedAt: account.deactivatedAt?.toISOString() ?? null,
        createdAt: account.createdAt.toISOString(),
      })),
      invitations: invitations.map((invitation) => ({
        ...invitation,
        expiresAt: invitation.expiresAt.toISOString(),
      })),
    };
  }

  async invite(
    session: AdminRequestSession,
    input: InvitationCreateRequest,
    requestId: string,
  ): Promise<IssuedInvitation> {
    const now = this.clock.now();
    const code = generateOpaqueToken();
    const expiresAt = addMs(now, INVITATION_TTL_MS);
    const invitationId = await this.prisma.serializable(async (tx) => {
      const existing = await tx.adminAccount.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      const pending = await tx.adminInvitation.findFirst({
        where: { email: input.email, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        select: { id: true },
      });
      if (existing || pending) {
        throw new BackofficeApiError('conflict', 'email already has an account or invitation');
      }
      const invitation = await tx.adminInvitation.create({
        data: {
          kind: 'OPERATOR',
          email: input.email,
          displayName: input.displayName,
          codeHash: invitationCodeHash(code),
          invitedByAccountId: session.accountId,
          expiresAt,
        },
        select: { id: true },
      });
      await this.audit.record(tx, {
        ...adminActor({ ...session, requestId }),
        action: 'INVITATION_CREATE',
        targetType: 'ADMIN_INVITATION',
        targetId: invitation.id,
        result: 'SUCCEEDED',
      });
      return invitation.id;
    });
    return { invitationId, code, expiresAt: expiresAt.toISOString() };
  }

  async revokeInvitation(
    session: AdminRequestSession,
    invitationId: string,
    requestId: string,
  ): Promise<void> {
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.adminInvitation.updateMany({
        where: { id: invitationId, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now },
      });
      if (revoked.count !== 1) {
        throw new BackofficeApiError('not_found');
      }
      await this.audit.record(tx, {
        ...adminActor({ ...session, requestId }),
        action: 'INVITATION_REVOKE',
        targetType: 'ADMIN_INVITATION',
        targetId: invitationId,
        result: 'SUCCEEDED',
      });
    });
  }

  async deactivate(
    session: AdminRequestSession,
    accountId: string,
    input: AccountDeactivateRequest,
    requestId: string,
  ): Promise<void> {
    if (accountId === session.accountId) {
      // An operator never ends their own account; another owner does (separation of duties).
      throw new BackofficeApiError('conflict', 'an account cannot deactivate itself');
    }
    const now = this.clock.now();
    const revokedRoles = await this.prisma.serializable(async (tx) => {
      const approvers = await this.roles.activeRoleChangeApprovers(tx);
      if (approvers.includes(accountId) && approvers.length === 1) {
        throw new BackofficeApiError('conflict', 'the last approver cannot be deactivated');
      }
      const deactivated = await tx.adminAccount.updateMany({
        where: { id: accountId, status: 'ACTIVE' },
        data: { status: 'DEACTIVATED', deactivatedAt: now },
      });
      if (deactivated.count !== 1) {
        throw new BackofficeApiError('not_found');
      }
      await tx.adminPasswordCredential.deleteMany({ where: { accountId } });
      await tx.adminPasskeyCredential.deleteMany({ where: { accountId } });
      await tx.adminTotpCredential.deleteMany({ where: { accountId } });
      await tx.adminRecoveryCode.deleteMany({ where: { accountId } });
      await this.sessions.revokeAllForAccount(tx, accountId, 'ACCOUNT_DEACTIVATED', now);
      const roles = await this.roles.activeRoles(tx, accountId);
      for (const role of roles) {
        const assignmentId = await this.roles.revoke(tx, {
          accountId,
          role,
          approvalRequestId: null,
          now,
        });
        await this.audit.record(tx, {
          ...adminActor({ ...session, requestId }),
          action: 'ROLE_REVOKE',
          targetType: 'ADMIN_ROLE_ASSIGNMENT',
          targetId: assignmentId,
          result: 'SUCCEEDED',
          metadata: { role, accountId, source: 'account_deactivation' },
        });
      }
      await this.audit.record(tx, {
        ...adminActor({ ...session, requestId }),
        action: 'ACCOUNT_DEACTIVATE',
        targetType: 'ADMIN_ACCOUNT',
        targetId: accountId,
        result: 'SUCCEEDED',
        reason: input.reason,
      });
      return roles.length;
    });
    for (let index = 0; index < revokedRoles; index += 1) {
      this.metrics.securityEvent('role_revoked');
    }
  }
}
