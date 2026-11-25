import type { AdminRole } from '@repo/database/enums';
import type { BackofficeTransaction } from '../../platform/database/backoffice-prisma.js';
import { LEGAL_APPROVER_ROLES, ROLE_CHANGE_APPROVER_ROLES } from '../permissions.js';

/**
 * Owner of `AdminRoleAssignment` writes (access-control). It depends only on the platform, so the
 * identity module can call it for the bootstrap grant and account deactivation while the approval
 * flow calls the identity module for session revocation.
 */
export class RoleAssignmentStore {
  async grant(
    tx: BackofficeTransaction,
    input: { accountId: string; role: AdminRole; approvalRequestId: string | null; now: Date },
  ): Promise<string> {
    const assignment = await tx.adminRoleAssignment.create({
      data: {
        accountId: input.accountId,
        role: input.role,
        grantedAt: input.now,
        grantedByApprovalRequestId: input.approvalRequestId,
      },
      select: { id: true },
    });
    return assignment.id;
  }

  /** Ends the one active assignment (partial unique index), or returns null when there is none. */
  async revoke(
    tx: BackofficeTransaction,
    input: { accountId: string; role: AdminRole; approvalRequestId: string | null; now: Date },
  ): Promise<string | null> {
    const active = await tx.adminRoleAssignment.findFirst({
      where: { accountId: input.accountId, role: input.role, revokedAt: null },
      select: { id: true },
    });
    if (!active) {
      return null;
    }
    const revoked = await tx.adminRoleAssignment.updateMany({
      where: { id: active.id, revokedAt: null },
      data: { revokedAt: input.now, revokedByApprovalRequestId: input.approvalRequestId },
    });
    return revoked.count === 1 ? active.id : null;
  }

  async activeRoles(tx: BackofficeTransaction, accountId: string): Promise<AdminRole[]> {
    const rows = await tx.adminRoleAssignment.findMany({
      where: { accountId, revokedAt: null },
      select: { role: true },
    });
    return rows.map((row) => row.role);
  }

  /** Active accounts that hold a role allowed to decide role grant and revoke requests. */
  activeRoleChangeApprovers(tx: BackofficeTransaction): Promise<string[]> {
    return this.activeApprovers(tx, ROLE_CHANGE_APPROVER_ROLES);
  }

  /** The active approvers of each request kind: role changes, then legal documents (OA-R9). */
  async activeApproversByKind(tx: BackofficeTransaction): Promise<string[][]> {
    return [
      await this.activeApprovers(tx, ROLE_CHANGE_APPROVER_ROLES),
      await this.activeApprovers(tx, LEGAL_APPROVER_ROLES),
    ];
  }

  /**
   * Active accounts that hold any of `roles`, counted when a request is decided (OA-R9): the
   * role change approvers, or the legal approvers for a legal request.
   */
  async activeApprovers(tx: BackofficeTransaction, roles: readonly AdminRole[]): Promise<string[]> {
    const rows = await tx.adminRoleAssignment.findMany({
      where: {
        revokedAt: null,
        role: { in: [...roles] },
        account: { status: 'ACTIVE' },
      },
      select: { accountId: true },
      distinct: ['accountId'],
    });
    return rows.map((row) => row.accountId);
  }
}
