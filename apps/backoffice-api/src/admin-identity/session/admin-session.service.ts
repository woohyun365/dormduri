import { lockAdminSessionRow } from '@repo/database/sql';
import type { AdminSessionRevocationReason, AdminSessionScope } from '@repo/database/enums';
import { permissionsForRoles } from '../../access-control/permissions.js';
import type { AdminAuditWriter } from '../../audit/admin-audit-writer.js';
import type {
  BackofficeRuntimePrisma,
  BackofficeTransaction,
} from '../../platform/database/backoffice-prisma.js';
import { BackofficeApiError } from '../../platform/http/api-error.js';
import type { AdminRequestSession } from '../../platform/http/request-context.js';
import { addMs, type Clock } from '../../platform/time/clock.js';
import { generateOpaqueToken, sha256Hex } from '../crypto/tokens.js';
import {
  evaluateSession,
  SESSION_ABSOLUTE_TIMEOUT_MS,
  SESSION_IDLE_TIMEOUT_MS,
} from './session-policy.js';

export interface IssuedSession {
  readonly sessionId: string;
  readonly token: string;
  readonly scope: AdminSessionScope;
  readonly absoluteExpiresAt: Date;
}

/**
 * Opaque DB sessions (README §3): the token goes to the BFF once and only its SHA-256 hash is stored.
 * Every request checks revocation, the absolute limit and the idle limit, then moves the last
 * activity time. There is no refresh token.
 */
export class AdminSessionService {
  constructor(
    private readonly prisma: BackofficeRuntimePrisma,
    private readonly audit: AdminAuditWriter,
    private readonly clock: Clock,
  ) {}

  async issue(
    tx: BackofficeTransaction,
    accountId: string,
    scope: AdminSessionScope,
    now: Date,
  ): Promise<IssuedSession> {
    const token = generateOpaqueToken();
    const absoluteExpiresAt = addMs(now, SESSION_ABSOLUTE_TIMEOUT_MS);
    const session = await tx.adminSession.create({
      data: {
        accountId,
        tokenHash: sha256Hex(token),
        scope,
        lastActivityAt: now,
        absoluteExpiresAt,
      },
      select: { id: true },
    });
    return { sessionId: session.id, token, scope, absoluteExpiresAt };
  }

  async resolve(token: string, requestId: string): Promise<AdminRequestSession> {
    const now = this.clock.now();
    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash: sha256Hex(token) },
      select: {
        id: true,
        accountId: true,
        scope: true,
        lastActivityAt: true,
        absoluteExpiresAt: true,
        reauthenticatedAt: true,
        revokedAt: true,
        account: {
          select: {
            status: true,
            roleAssignments: { where: { revokedAt: null }, select: { role: true } },
          },
        },
      },
    });
    if (!session) {
      throw new BackofficeApiError('session_required');
    }
    const state = evaluateSession(session, now);
    if (state === 'revoked' || session.account.status !== 'ACTIVE') {
      throw new BackofficeApiError('session_required');
    }
    if (state !== 'active') {
      await this.recordExpiry(session.id, session.accountId, state, requestId);
      throw new BackofficeApiError('session_expired');
    }
    const touched = await this.prisma.adminSession.updateMany({
      where: {
        id: session.id,
        revokedAt: null,
        absoluteExpiresAt: { gt: now },
        lastActivityAt: { gt: addMs(now, -SESSION_IDLE_TIMEOUT_MS) },
      },
      data: { lastActivityAt: now },
    });
    if (touched.count !== 1) {
      throw new BackofficeApiError('session_expired');
    }
    const roles = session.account.roleAssignments.map((assignment) => assignment.role);
    return {
      sessionId: session.id,
      accountId: session.accountId,
      scope: session.scope,
      roles,
      // A recovery-scope session holds no permission: it may only register a passkey and log out.
      permissions: session.scope === 'FULL' ? permissionsForRoles(roles) : new Set(),
      reauthenticatedAt: session.reauthenticatedAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
      lastActivityAt: now,
    };
  }

  async revoke(
    tx: BackofficeTransaction,
    sessionId: string,
    reason: AdminSessionRevocationReason,
    now: Date,
  ): Promise<boolean> {
    const result = await tx.adminSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now, revocationReason: reason },
    });
    return result.count === 1;
  }

  async revokeAllForAccount(
    tx: BackofficeTransaction,
    accountId: string,
    reason: AdminSessionRevocationReason,
    now: Date,
  ): Promise<number> {
    const result = await tx.adminSession.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: now, revocationReason: reason },
    });
    return result.count;
  }

  /**
   * The request after an idle or absolute expiry leaves one audit row for that session. When no
   * such request comes, the last audit action and the session row show when the access ended.
   * Concurrent requests on the expired session wait on its row lock, so the later ones see the row.
   */
  private async recordExpiry(
    sessionId: string,
    accountId: string,
    state: 'idle_expired' | 'absolute_expired',
    requestId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRawTyped(lockAdminSessionRow(sessionId));
      const already = await tx.adminAuditEvent.findFirst({
        where: { targetType: 'ADMIN_SESSION', targetId: sessionId, action: 'SESSION_EXPIRED' },
        select: { id: true },
      });
      if (already) {
        return;
      }
      await this.audit.record(tx, {
        actorType: 'SYSTEM',
        sessionId,
        action: 'SESSION_EXPIRED',
        targetType: 'ADMIN_SESSION',
        targetId: sessionId,
        result: 'SUCCEEDED',
        requestId,
        metadata: { accountId, expiry: state === 'idle_expired' ? 'idle' : 'absolute' },
      });
    });
  }
}
