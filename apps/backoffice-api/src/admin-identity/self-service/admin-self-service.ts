import { Prisma } from '@repo/database/client';
import { lockAdminAccountRow } from '@repo/database/sql';
import type {
  PasskeyRegistrationRequest,
  ReauthenticationRequest,
  TotpConfirmRequest,
} from '@repo/shared/backoffice';
import { adminActor, type AdminAuditWriter } from '../../audit/admin-audit-writer.js';
import type { BackofficeRuntimePrisma } from '../../platform/database/backoffice-prisma.js';
import { BackofficeApiError } from '../../platform/http/api-error.js';
import type { AdminRequestSession } from '../../platform/http/request-context.js';
import { addMs, type Clock } from '../../platform/time/clock.js';
import type { CredentialIssuer, IssuedTotp } from '../credential-issuer.js';
import type { SecretBox } from '../crypto/secret-box.js';
import { verifyTotp } from '../crypto/totp.js';
import { totpAssociatedData } from '../login/admin-login.service.js';
import type { AdminSessionService } from '../session/admin-session.service.js';
import {
  isRecentlyReauthenticated,
  REAUTHENTICATION_WINDOW_MS,
  SESSION_IDLE_TIMEOUT_MS,
} from '../session/session-policy.js';
import { WEBAUTHN_CHALLENGE_TTL_MS, type WebAuthnService } from '../webauthn/webauthn.service.js';

type ChallengePurpose = 'REGISTRATION' | 'REAUTHENTICATION';

/** What an operator does with their own session and credentials. */
export class AdminSelfService {
  constructor(
    private readonly prisma: BackofficeRuntimePrisma,
    private readonly audit: AdminAuditWriter,
    private readonly sessions: AdminSessionService,
    private readonly webauthn: WebAuthnService,
    private readonly secretBox: SecretBox,
    private readonly credentials: CredentialIssuer,
    private readonly clock: Clock,
  ) {}

  async sessionInfo(session: AdminRequestSession) {
    const account = await this.prisma.adminAccount.findUniqueOrThrow({
      where: { id: session.accountId },
      select: {
        id: true,
        email: true,
        displayName: true,
        totpCredential: { select: { confirmedAt: true } },
        _count: {
          select: { recoveryCodes: { where: { usedAt: null } }, passkeyCredentials: true },
        },
      },
    });
    const reauthenticatedUntil = isRecentlyReauthenticated(
      session.reauthenticatedAt,
      this.clock.now(),
    )
      ? addMs(session.reauthenticatedAt!, REAUTHENTICATION_WINDOW_MS)
      : null;
    return {
      account: { id: account.id, email: account.email, displayName: account.displayName },
      scope: session.scope,
      roles: [...session.roles],
      permissions: [...session.permissions].sort(),
      idleExpiresAt: addMs(session.lastActivityAt, SESSION_IDLE_TIMEOUT_MS).toISOString(),
      absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
      reauthenticatedUntil: reauthenticatedUntil?.toISOString() ?? null,
      totpConfirmed: account.totpCredential?.confirmedAt != null,
      recoveryCodesRemaining: account._count.recoveryCodes,
      passkeyCount: account._count.passkeyCredentials,
    };
  }

  async logout(session: AdminRequestSession, requestId: string): Promise<void> {
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await this.sessions.revoke(tx, session.sessionId, 'LOGOUT', now);
      await this.audit.record(tx, {
        ...adminActor({ ...session, requestId }),
        action: 'LOGOUT',
        targetType: 'ADMIN_SESSION',
        targetId: session.sessionId,
        result: 'SUCCEEDED',
      });
    });
  }

  async reauthenticationOptions(session: AdminRequestSession) {
    const passkeys = await this.passkeyIds(session.accountId);
    const options = await this.webauthn.authenticationOptions(passkeys);
    const challengeId = await this.createChallenge(session, 'REAUTHENTICATION', options.challenge);
    return { challengeId, options };
  }

  async reauthenticate(
    session: AdminRequestSession,
    input: ReauthenticationRequest,
    requestId: string,
  ): Promise<{ reauthenticatedUntil: string }> {
    const challenge = await this.consumeChallenge(session, input.challengeId, 'REAUTHENTICATION');
    const passkey = await this.prisma.adminPasskeyCredential.findFirst({
      where: { accountId: session.accountId, credentialId: input.credential.id },
      select: { id: true, credentialId: true, publicKey: true, counter: true, transports: true },
    });
    const verified = passkey
      ? await this.webauthn.verifyAuthentication(input.credential, challenge, passkey)
      : null;
    const now = this.clock.now();
    if (!passkey || !verified) {
      await this.prisma.$transaction(async (tx) => {
        await this.audit.record(tx, {
          ...adminActor({ ...session, requestId }),
          action: 'REAUTHENTICATE',
          targetType: 'ADMIN_SESSION',
          targetId: session.sessionId,
          result: 'FAILED',
        });
      });
      throw new BackofficeApiError('authentication_failed');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.adminPasskeyCredential.update({
        where: { id: passkey.id },
        data: { counter: BigInt(verified.newCounter), lastUsedAt: now },
      });
      const updated = await tx.adminSession.updateMany({
        where: { id: session.sessionId, revokedAt: null },
        data: { reauthenticatedAt: now },
      });
      if (updated.count !== 1) {
        throw new BackofficeApiError('session_required');
      }
      await this.audit.record(tx, {
        ...adminActor({ ...session, requestId }),
        action: 'REAUTHENTICATE',
        targetType: 'ADMIN_SESSION',
        targetId: session.sessionId,
        result: 'SUCCEEDED',
      });
    });
    return { reauthenticatedUntil: addMs(now, REAUTHENTICATION_WINDOW_MS).toISOString() };
  }

  /**
   * A recovery-scope session exists to register a new passkey (OA-R2). A full session adding a
   * passkey needs a recent re-authentication, so a stolen session alone cannot plant a credential.
   */
  async passkeyRegistrationOptions(session: AdminRequestSession) {
    this.assertMayAddPasskey(session);
    const account = await this.prisma.adminAccount.findUniqueOrThrow({
      where: { id: session.accountId },
      select: { email: true, displayName: true },
    });
    const options = await this.webauthn.registrationOptions({
      accountId: session.accountId,
      userName: account.email,
      userDisplayName: account.displayName,
      excludeCredentialIds: await this.passkeyIds(session.accountId),
    });
    const challengeId = await this.createChallenge(session, 'REGISTRATION', options.challenge);
    return { challengeId, options };
  }

  async registerPasskey(
    session: AdminRequestSession,
    input: PasskeyRegistrationRequest,
    requestId: string,
  ): Promise<{ passkeyId: string }> {
    this.assertMayAddPasskey(session);
    const challenge = await this.consumeChallenge(session, input.challengeId, 'REGISTRATION');
    const passkey = await this.webauthn.verifyRegistration(input.credential, challenge);
    if (!passkey) {
      throw new BackofficeApiError('authentication_failed');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const stored = await tx.adminPasskeyCredential.create({
          data: {
            accountId: session.accountId,
            credentialId: passkey.credentialId,
            publicKey: Buffer.from(passkey.publicKey),
            counter: BigInt(passkey.counter),
            transports: passkey.transports,
            deviceType: passkey.deviceType === 'multiDevice' ? 'MULTI_DEVICE' : 'SINGLE_DEVICE',
            backedUp: passkey.backedUp,
            label: input.label ?? null,
          },
          select: { id: true },
        });
        await this.audit.record(tx, {
          ...adminActor({ ...session, requestId }),
          action: 'PASSKEY_REGISTER',
          targetType: 'ADMIN_PASSKEY_CREDENTIAL',
          targetId: stored.id,
          result: 'SUCCEEDED',
          metadata: { scope: session.scope },
        });
        return { passkeyId: stored.id };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BackofficeApiError('conflict', 'passkey already registered');
      }
      throw error;
    }
  }

  async confirmTotp(
    session: AdminRequestSession,
    input: TotpConfirmRequest,
    requestId: string,
  ): Promise<void> {
    const now = this.clock.now();
    const credential = await this.prisma.adminTotpCredential.findUnique({
      where: { accountId: session.accountId },
      select: { secretCiphertext: true, confirmedAt: true, lastUsedTimeStep: true },
    });
    if (!credential || credential.confirmedAt !== null) {
      throw new BackofficeApiError('conflict', 'no unconfirmed TOTP');
    }
    const result = verifyTotp({
      secret: this.secretBox.open(
        credential.secretCiphertext,
        totpAssociatedData(session.accountId),
      ),
      code: input.code,
      at: now,
      lastUsedStep:
        credential.lastUsedTimeStep === null ? null : Number(credential.lastUsedTimeStep),
    });
    if (!result.ok) {
      throw new BackofficeApiError('authentication_failed');
    }
    await this.prisma.$transaction(async (tx) => {
      const confirmed = await tx.adminTotpCredential.updateMany({
        where: { accountId: session.accountId, confirmedAt: null },
        data: { confirmedAt: now, lastUsedTimeStep: BigInt(result.step) },
      });
      if (confirmed.count !== 1) {
        throw new BackofficeApiError('conflict', 'TOTP already confirmed');
      }
      await this.audit.record(tx, {
        ...adminActor({ ...session, requestId }),
        action: 'TOTP_ENROLL',
        targetType: 'ADMIN_ACCOUNT',
        targetId: session.accountId,
        result: 'SUCCEEDED',
        metadata: { stage: 'confirmed' },
      });
    });
  }

  // Reissues lock the account row first, so two concurrent reissues run one after the other and
  // the later one replaces what the earlier one issued (one TOTP secret, ten recovery codes).
  async reissueTotp(session: AdminRequestSession, requestId: string): Promise<IssuedTotp> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawTyped(lockAdminAccountRow(session.accountId));
      const account = await tx.adminAccount.findUniqueOrThrow({
        where: { id: session.accountId },
        select: { email: true },
      });
      const totp = await this.credentials.issueTotp(tx, session.accountId, account.email);
      await this.audit.record(tx, {
        ...adminActor({ ...session, requestId }),
        action: 'TOTP_ENROLL',
        targetType: 'ADMIN_ACCOUNT',
        targetId: session.accountId,
        result: 'SUCCEEDED',
        metadata: { stage: 'issued' },
      });
      return totp;
    });
  }

  async reissueRecoveryCodes(session: AdminRequestSession, requestId: string): Promise<string[]> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawTyped(lockAdminAccountRow(session.accountId));
      const codes = await this.credentials.issueRecoveryCodes(tx, session.accountId);
      await this.audit.record(tx, {
        ...adminActor({ ...session, requestId }),
        action: 'RECOVERY_CODES_ISSUE',
        targetType: 'ADMIN_ACCOUNT',
        targetId: session.accountId,
        result: 'SUCCEEDED',
        metadata: { count: codes.length },
      });
      return codes;
    });
  }

  private assertMayAddPasskey(session: AdminRequestSession): void {
    if (
      session.scope === 'FULL' &&
      !isRecentlyReauthenticated(session.reauthenticatedAt, this.clock.now())
    ) {
      throw new BackofficeApiError('reauthentication_required');
    }
  }

  private async passkeyIds(accountId: string): Promise<string[]> {
    const rows = await this.prisma.adminPasskeyCredential.findMany({
      where: { accountId },
      select: { credentialId: true },
    });
    return rows.map((row) => row.credentialId);
  }

  private async createChallenge(
    session: AdminRequestSession,
    purpose: ChallengePurpose,
    challenge: string,
  ): Promise<string> {
    const row = await this.prisma.adminWebAuthnChallenge.create({
      data: {
        purpose,
        challenge,
        accountId: session.accountId,
        sessionId: session.sessionId,
        expiresAt: addMs(this.clock.now(), WEBAUTHN_CHALLENGE_TTL_MS),
      },
      select: { id: true },
    });
    return row.id;
  }

  /** A challenge belongs to the session that asked for it and is used once. */
  private async consumeChallenge(
    session: AdminRequestSession,
    challengeId: string,
    purpose: ChallengePurpose,
  ): Promise<string> {
    const now = this.clock.now();
    const row = await this.prisma.adminWebAuthnChallenge.findUnique({
      where: { id: challengeId },
      select: { purpose: true, challenge: true, sessionId: true, usedAt: true, expiresAt: true },
    });
    if (
      !row ||
      row.purpose !== purpose ||
      row.sessionId !== session.sessionId ||
      row.usedAt !== null ||
      row.expiresAt.getTime() <= now.getTime()
    ) {
      throw new BackofficeApiError('authentication_failed');
    }
    const consumed = await this.prisma.adminWebAuthnChallenge.updateMany({
      where: { id: challengeId, usedAt: null },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) {
      throw new BackofficeApiError('authentication_failed');
    }
    return row.challenge;
  }
}
