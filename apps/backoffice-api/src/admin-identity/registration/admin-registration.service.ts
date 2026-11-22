import { Prisma } from '@repo/database/client';
import type { RegistrationOptionsRequest, RegistrationRequest } from '@repo/shared/backoffice';
import type { RoleAssignmentStore } from '../../access-control/roles/role-assignment.store.js';
import type { AdminAuditWriter } from '../../audit/admin-audit-writer.js';
import type { BackofficeRuntimePrisma } from '../../platform/database/backoffice-prisma.js';
import { BackofficeApiError } from '../../platform/http/api-error.js';
import type { BackofficeMetrics } from '../../platform/observability/backoffice-metrics.js';
import { addMs, type Clock } from '../../platform/time/clock.js';
import type { CredentialIssuer, IssuedTotp } from '../credential-issuer.js';
import type { PasswordHasher } from '../crypto/password-hasher.js';
import { sha256Hex } from '../crypto/tokens.js';
import type { AdminSessionService, IssuedSession } from '../session/admin-session.service.js';
import { WEBAUTHN_CHALLENGE_TTL_MS, type WebAuthnService } from '../webauthn/webauthn.service.js';

export interface RegistrationResult {
  readonly session: IssuedSession;
  readonly accountId: string;
  readonly totp: IssuedTotp;
  readonly recoveryCodes: readonly string[];
}

export function invitationCodeHash(code: string): string {
  return sha256Hex(`invitation:${code}`);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Accepting an invitation (OA-R10): one-time code → password → passkey → TOTP and recovery codes.
 * The account takes the invitation id, so the WebAuthn user handle (the account id) is fixed
 * before the account row exists and stays the same for every passkey of that account.
 */
export class AdminRegistrationService {
  constructor(
    private readonly prisma: BackofficeRuntimePrisma,
    private readonly audit: AdminAuditWriter,
    private readonly sessions: AdminSessionService,
    private readonly webauthn: WebAuthnService,
    private readonly passwords: PasswordHasher,
    private readonly credentials: CredentialIssuer,
    private readonly roles: RoleAssignmentStore,
    private readonly metrics: BackofficeMetrics,
    private readonly clock: Clock,
  ) {}

  async options(input: RegistrationOptionsRequest) {
    const now = this.clock.now();
    const invitation = await this.findUsableInvitation(input.code, now);
    const options = await this.webauthn.registrationOptions({
      accountId: invitation.id,
      userName: invitation.email,
      userDisplayName: invitation.displayName,
      excludeCredentialIds: [],
    });
    const challenge = await this.prisma.adminWebAuthnChallenge.create({
      data: {
        purpose: 'REGISTRATION',
        challenge: options.challenge,
        invitationId: invitation.id,
        expiresAt: addMs(now, WEBAUTHN_CHALLENGE_TTL_MS),
      },
      select: { id: true },
    });
    return {
      challengeId: challenge.id,
      options,
      email: invitation.email,
      displayName: invitation.displayName,
    };
  }

  async register(input: RegistrationRequest, requestId: string): Promise<RegistrationResult> {
    const now = this.clock.now();
    const invitation = await this.findUsableInvitation(input.code, now);
    const challenge = await this.prisma.adminWebAuthnChallenge.findUnique({
      where: { id: input.challengeId },
      select: { purpose: true, challenge: true, invitationId: true, usedAt: true, expiresAt: true },
    });
    if (
      !challenge ||
      challenge.purpose !== 'REGISTRATION' ||
      challenge.invitationId !== invitation.id ||
      challenge.usedAt !== null ||
      challenge.expiresAt.getTime() <= now.getTime()
    ) {
      throw new BackofficeApiError('authentication_failed');
    }
    const passkey = await this.webauthn.verifyRegistration(input.credential, challenge.challenge);
    if (!passkey) {
      throw new BackofficeApiError('authentication_failed');
    }
    const passwordHash = await this.passwords.hash(input.password);
    const accountId = invitation.id;

    try {
      const result = await this.prisma.serializable(async (tx) => {
        const consumed = await tx.adminWebAuthnChallenge.updateMany({
          where: { id: input.challengeId, usedAt: null },
          data: { usedAt: now },
        });
        if (consumed.count !== 1) {
          throw new BackofficeApiError('authentication_failed');
        }
        if (invitation.kind === 'BOOTSTRAP_OWNER') {
          // The first owner only: any active account closes the bootstrap path (OA-R10).
          const active = await tx.adminAccount.count({ where: { status: 'ACTIVE' } });
          if (active > 0) {
            throw new BackofficeApiError('conflict', 'bootstrap invitation with an active account');
          }
        }
        await tx.adminAccount.create({
          data: { id: accountId, email: invitation.email, displayName: invitation.displayName },
        });
        await tx.adminPasswordCredential.create({ data: { accountId, passwordHash } });
        const stored = await tx.adminPasskeyCredential.create({
          data: {
            accountId,
            credentialId: passkey.credentialId,
            publicKey: Buffer.from(passkey.publicKey),
            counter: BigInt(passkey.counter),
            transports: passkey.transports,
            deviceType: passkey.deviceType === 'multiDevice' ? 'MULTI_DEVICE' : 'SINGLE_DEVICE',
            backedUp: passkey.backedUp,
            label: input.passkeyLabel ?? null,
          },
          select: { id: true },
        });
        const accepted = await tx.adminInvitation.updateMany({
          where: { id: invitation.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now, acceptedAccountId: accountId },
        });
        if (accepted.count !== 1) {
          throw new BackofficeApiError('authentication_failed');
        }
        const actor = {
          actorType: 'ADMIN',
          actorAccountId: accountId,
          accessPath: 'SSM_PORT_FORWARD',
          requestId,
        } as const;
        await this.audit.record(tx, {
          ...actor,
          action: 'INVITATION_ACCEPT',
          targetType: 'ADMIN_INVITATION',
          targetId: invitation.id,
          result: 'SUCCEEDED',
          metadata: { kind: invitation.kind },
        });
        if (invitation.kind === 'BOOTSTRAP_OWNER') {
          // The first owner is granted by the system actor; every later grant is an approval request.
          const assignmentId = await this.roles.grant(tx, {
            accountId,
            role: 'OWNER',
            approvalRequestId: null,
            now,
          });
          await this.audit.record(tx, {
            actorType: 'SYSTEM',
            action: 'ROLE_GRANT',
            targetType: 'ADMIN_ROLE_ASSIGNMENT',
            targetId: assignmentId,
            result: 'SUCCEEDED',
            requestId,
            metadata: { role: 'OWNER', accountId, source: 'bootstrap' },
          });
        }
        await this.audit.record(tx, {
          ...actor,
          action: 'PASSKEY_REGISTER',
          targetType: 'ADMIN_PASSKEY_CREDENTIAL',
          targetId: stored.id,
          result: 'SUCCEEDED',
        });
        const totp = await this.credentials.issueTotp(tx, accountId, invitation.email);
        await this.audit.record(tx, {
          ...actor,
          action: 'TOTP_ENROLL',
          targetType: 'ADMIN_ACCOUNT',
          targetId: accountId,
          result: 'SUCCEEDED',
          metadata: { stage: 'issued' },
        });
        const recoveryCodes = await this.credentials.issueRecoveryCodes(tx, accountId);
        await this.audit.record(tx, {
          ...actor,
          action: 'RECOVERY_CODES_ISSUE',
          targetType: 'ADMIN_ACCOUNT',
          targetId: accountId,
          result: 'SUCCEEDED',
          metadata: { count: recoveryCodes.length },
        });
        const session = await this.sessions.issue(tx, accountId, 'FULL', now);
        await tx.adminAccount.update({ where: { id: accountId }, data: { lastLoginAt: now } });
        await this.audit.record(tx, {
          ...actor,
          sessionId: session.sessionId,
          action: 'LOGIN',
          targetType: 'ADMIN_SESSION',
          targetId: session.sessionId,
          result: 'SUCCEEDED',
          metadata: { scope: 'FULL', method: 'registration' },
        });
        return { session, accountId, totp, recoveryCodes };
      });
      if (invitation.kind === 'BOOTSTRAP_OWNER') {
        this.metrics.securityEvent('bootstrap_owner_used');
      }
      return result;
    } catch (error) {
      if (isUniqueViolation(error)) {
        // The email or the passkey credential already belongs to an account.
        throw new BackofficeApiError('conflict', 'registration conflicts with an existing account');
      }
      throw error;
    }
  }

  private async findUsableInvitation(code: string, now: Date) {
    const invitation = await this.prisma.adminInvitation.findUnique({
      where: { codeHash: invitationCodeHash(code) },
      select: {
        id: true,
        kind: true,
        email: true,
        displayName: true,
        expiresAt: true,
        usedAt: true,
        revokedAt: true,
      },
    });
    if (
      !invitation ||
      invitation.usedAt !== null ||
      invitation.revokedAt !== null ||
      invitation.expiresAt.getTime() <= now.getTime()
    ) {
      throw new BackofficeApiError('authentication_failed');
    }
    return invitation;
  }
}
