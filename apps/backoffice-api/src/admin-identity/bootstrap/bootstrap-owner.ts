import type { AdminAuditWriter } from '../../audit/admin-audit-writer.js';
import type { BackofficeRuntimePrisma } from '../../platform/database/backoffice-prisma.js';
import { addMs, type Clock } from '../../platform/time/clock.js';
import { INVITATION_TTL_MS, type IssuedInvitation } from '../accounts/admin-accounts.service.js';
import { generateOpaqueToken } from '../crypto/tokens.js';
import { invitationCodeHash } from '../registration/admin-registration.service.js';

export class BootstrapRefusedError extends Error {
  constructor() {
    super('bootstrap-owner refused: an active backoffice account already exists');
    this.name = 'BootstrapRefusedError';
  }
}

/**
 * The one-off `bootstrap-owner` command (operator-access.md OA-R10). With no active account it creates an owner
 * invitation whose code works once within 15 minutes; an earlier unused bootstrap invitation is
 * revoked so only the newest code works. With any active account it refuses. The grant itself
 * happens when the invitation is accepted, as the system actor.
 */
export async function issueBootstrapOwnerInvitation(
  deps: { prisma: BackofficeRuntimePrisma; audit: AdminAuditWriter; clock: Clock },
  input: { email: string; displayName: string },
): Promise<IssuedInvitation> {
  const now = deps.clock.now();
  const code = generateOpaqueToken();
  const expiresAt = addMs(now, INVITATION_TTL_MS);
  const invitationId = await deps.prisma.serializable(async (tx) => {
    const active = await tx.adminAccount.count({ where: { status: 'ACTIVE' } });
    if (active > 0) {
      throw new BootstrapRefusedError();
    }
    await tx.adminInvitation.updateMany({
      where: { kind: 'BOOTSTRAP_OWNER', usedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    const invitation = await tx.adminInvitation.create({
      data: {
        kind: 'BOOTSTRAP_OWNER',
        email: input.email,
        displayName: input.displayName,
        codeHash: invitationCodeHash(code),
        expiresAt,
      },
      select: { id: true },
    });
    await deps.audit.record(tx, {
      actorType: 'SYSTEM',
      action: 'BOOTSTRAP_OWNER',
      targetType: 'ADMIN_INVITATION',
      targetId: invitation.id,
      result: 'SUCCEEDED',
      metadata: { expiresInMinutes: INVITATION_TTL_MS / 60_000 },
    });
    return invitation.id;
  });
  return { invitationId, code, expiresAt: expiresAt.toISOString() };
}
