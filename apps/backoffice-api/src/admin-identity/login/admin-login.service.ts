import type {
  LoginPasskeyRequest,
  LoginPasswordRequest,
  LoginRecoveryCodeRequest,
  LoginTotpRequest,
} from '@repo/shared/backoffice';
import type { AdminAuditWriter } from '../../audit/admin-audit-writer.js';
import type {
  BackofficeRuntimePrisma,
  BackofficeTransaction,
} from '../../platform/database/backoffice-prisma.js';
import { BackofficeApiError } from '../../platform/http/api-error.js';
import type { BackofficeMetrics } from '../../platform/observability/backoffice-metrics.js';
import { addMs, type Clock } from '../../platform/time/clock.js';
import { hashRecoveryCode } from '../crypto/recovery-codes.js';
import type { SecretBox } from '../crypto/secret-box.js';
import { verifyTotp } from '../crypto/totp.js';
import type { PasswordHasher } from '../crypto/password-hasher.js';
import type { AdminSessionService, IssuedSession } from '../session/admin-session.service.js';
import { WEBAUTHN_CHALLENGE_TTL_MS, type WebAuthnService } from '../webauthn/webauthn.service.js';
import { isLocked, LOCKOUT_DURATION_MS, shouldLock } from './lockout-policy.js';

export interface PasswordStepResult {
  readonly challengeId: string;
  readonly options: Awaited<ReturnType<WebAuthnService['authenticationOptions']>>;
  readonly recovery: { readonly totp: boolean; readonly recoveryCode: boolean };
}

type SecondFactorStep = 'passkey' | 'totp' | 'recovery_code';

export function totpAssociatedData(accountId: string): string {
  return `admin-totp:${accountId}`;
}

/**
 * Two-step login (OA-R2, OA-R5). The password step answers the same way for an unknown,
 * locked or deactivated account and a wrong password. A correct password opens one five-minute
 * challenge that one second-factor attempt consumes: a passkey gives a full session, a TOTP or
 * recovery code gives a recovery-scope session.
 */
export class AdminLoginService {
  constructor(
    private readonly prisma: BackofficeRuntimePrisma,
    private readonly audit: AdminAuditWriter,
    private readonly sessions: AdminSessionService,
    private readonly webauthn: WebAuthnService,
    private readonly passwords: PasswordHasher,
    private readonly secretBox: SecretBox,
    private readonly metrics: BackofficeMetrics,
    private readonly clock: Clock,
  ) {}

  async passwordStep(input: LoginPasswordRequest, requestId: string): Promise<PasswordStepResult> {
    const now = this.clock.now();
    const account = await this.prisma.adminAccount.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        status: true,
        lockedUntil: true,
        passwordCredential: { select: { passwordHash: true } },
        passkeyCredentials: { select: { credentialId: true } },
        totpCredential: { select: { confirmedAt: true } },
        recoveryCodes: { where: { usedAt: null }, select: { id: true } },
      },
    });
    if (!account || account.status !== 'ACTIVE' || !account.passwordCredential) {
      await this.passwords.verifyDummy(input.password);
      await this.recordAnonymousFailure(requestId);
      throw new BackofficeApiError('authentication_failed');
    }
    if (isLocked(account.lockedUntil, now)) {
      await this.passwords.verifyDummy(input.password);
      await this.recordLockedAttempt(account.id, requestId);
      throw new BackofficeApiError('authentication_failed');
    }
    const passwordOk = await this.passwords.verify(
      account.passwordCredential.passwordHash,
      input.password,
    );
    if (!passwordOk) {
      await this.recordFailure(account.id, 'password', requestId);
      throw new BackofficeApiError('authentication_failed');
    }
    const options = await this.webauthn.authenticationOptions(
      account.passkeyCredentials.map((passkey) => passkey.credentialId),
    );
    const challenge = await this.prisma.adminWebAuthnChallenge.create({
      data: {
        purpose: 'AUTHENTICATION',
        challenge: options.challenge,
        accountId: account.id,
        expiresAt: addMs(now, WEBAUTHN_CHALLENGE_TTL_MS),
      },
      select: { id: true },
    });
    return {
      challengeId: challenge.id,
      options,
      recovery: {
        totp: account.totpCredential?.confirmedAt != null,
        recoveryCode: account.recoveryCodes.length > 0,
      },
    };
  }

  async passkeyStep(input: LoginPasskeyRequest, requestId: string): Promise<IssuedSession> {
    const { accountId, challenge } = await this.consumeLoginChallenge(input.challengeId);
    const passkey = await this.prisma.adminPasskeyCredential.findFirst({
      where: { accountId, credentialId: input.credential.id },
      select: { id: true, credentialId: true, publicKey: true, counter: true, transports: true },
    });
    const verified = passkey
      ? await this.webauthn.verifyAuthentication(input.credential, challenge, passkey)
      : null;
    if (!passkey || !verified) {
      await this.recordFailure(accountId, 'passkey', requestId);
      throw new BackofficeApiError('authentication_failed');
    }
    return this.completeLogin(accountId, 'FULL', 'passkey', requestId, async (tx, now) => {
      await tx.adminPasskeyCredential.update({
        where: { id: passkey.id },
        data: { counter: BigInt(verified.newCounter), lastUsedAt: now },
      });
    });
  }

  async totpStep(input: LoginTotpRequest, requestId: string): Promise<IssuedSession> {
    const { accountId } = await this.consumeLoginChallenge(input.challengeId);
    const now = this.clock.now();
    const credential = await this.prisma.adminTotpCredential.findUnique({
      where: { accountId },
      select: { secretCiphertext: true, lastUsedTimeStep: true, confirmedAt: true },
    });
    const result =
      credential?.confirmedAt != null
        ? verifyTotp({
            secret: this.secretBox.open(credential.secretCiphertext, totpAssociatedData(accountId)),
            code: input.code,
            at: now,
            lastUsedStep:
              credential.lastUsedTimeStep === null ? null : Number(credential.lastUsedTimeStep),
          })
        : ({ ok: false } as const);
    if (!result.ok) {
      await this.recordFailure(accountId, 'totp', requestId);
      throw new BackofficeApiError('authentication_failed');
    }
    return this.completeLogin(accountId, 'RECOVERY', 'totp', requestId, async (tx) => {
      // The step guard makes a concurrent use of the same code lose (no replay within the window).
      const updated = await tx.adminTotpCredential.updateMany({
        where: {
          accountId,
          OR: [{ lastUsedTimeStep: null }, { lastUsedTimeStep: { lt: BigInt(result.step) } }],
        },
        data: { lastUsedTimeStep: BigInt(result.step) },
      });
      if (updated.count !== 1) {
        throw new BackofficeApiError('authentication_failed');
      }
    });
  }

  async recoveryCodeStep(
    input: LoginRecoveryCodeRequest,
    requestId: string,
  ): Promise<IssuedSession> {
    const { accountId } = await this.consumeLoginChallenge(input.challengeId);
    const code = await this.prisma.adminRecoveryCode.findFirst({
      where: { accountId, codeHash: hashRecoveryCode(input.code), usedAt: null },
      select: { id: true },
    });
    if (!code) {
      await this.recordFailure(accountId, 'recovery_code', requestId);
      throw new BackofficeApiError('authentication_failed');
    }
    return this.completeLogin(
      accountId,
      'RECOVERY',
      'recovery_code',
      requestId,
      async (tx, now) => {
        const used = await tx.adminRecoveryCode.updateMany({
          where: { id: code.id, usedAt: null },
          data: { usedAt: now },
        });
        if (used.count !== 1) {
          throw new BackofficeApiError('authentication_failed');
        }
      },
    );
  }

  /** One attempt per password step: the challenge is used whether the factor passes or not. */
  private async consumeLoginChallenge(
    challengeId: string,
  ): Promise<{ accountId: string; challenge: string }> {
    const now = this.clock.now();
    const row = await this.prisma.adminWebAuthnChallenge.findUnique({
      where: { id: challengeId },
      select: {
        purpose: true,
        challenge: true,
        accountId: true,
        sessionId: true,
        expiresAt: true,
        usedAt: true,
        account: { select: { status: true, lockedUntil: true } },
      },
    });
    if (
      !row ||
      row.purpose !== 'AUTHENTICATION' ||
      row.accountId === null ||
      row.sessionId !== null ||
      row.usedAt !== null ||
      row.expiresAt.getTime() <= now.getTime() ||
      row.account?.status !== 'ACTIVE' ||
      isLocked(row.account.lockedUntil, now)
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
    return { accountId: row.accountId, challenge: row.challenge };
  }

  private async completeLogin(
    accountId: string,
    scope: 'FULL' | 'RECOVERY',
    method: SecondFactorStep,
    requestId: string,
    consumeFactor: (tx: BackofficeTransaction, now: Date) => Promise<void>,
  ): Promise<IssuedSession> {
    const now = this.clock.now();
    const session = await this.prisma.$transaction(async (tx) => {
      await consumeFactor(tx, now);
      await tx.adminAccount.update({
        where: { id: accountId },
        data: { failedAuthAttemptCount: 0, lastLoginAt: now },
      });
      const issued = await this.sessions.issue(tx, accountId, scope, now);
      await this.audit.record(tx, {
        actorType: 'ADMIN',
        actorAccountId: accountId,
        sessionId: issued.sessionId,
        accessPath: 'SSM_PORT_FORWARD',
        action: 'LOGIN',
        targetType: 'ADMIN_SESSION',
        targetId: issued.sessionId,
        result: 'SUCCEEDED',
        requestId,
        metadata: { scope, method },
      });
      return issued;
    });
    if (scope === 'RECOVERY') {
      this.metrics.securityEvent('recovery_login');
    }
    return session;
  }

  private async recordAnonymousFailure(requestId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.audit.record(tx, {
        actorType: 'ANONYMOUS',
        accessPath: 'SSM_PORT_FORWARD',
        action: 'LOGIN',
        result: 'FAILED',
        requestId,
        metadata: { step: 'password', account: 'unknown' },
      });
    });
  }

  private async recordLockedAttempt(accountId: string, requestId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.audit.record(tx, {
        actorType: 'ANONYMOUS',
        accessPath: 'SSM_PORT_FORWARD',
        action: 'LOGIN',
        targetType: 'ADMIN_ACCOUNT',
        targetId: accountId,
        result: 'DENIED',
        requestId,
        metadata: { step: 'password', locked: true },
      });
    });
  }

  /**
   * Counts a failed password or second factor. The fifth consecutive failure locks the account
   * for 15 minutes, ends its sessions, restarts the count and raises the lock alert.
   */
  private async recordFailure(
    accountId: string,
    step: 'password' | SecondFactorStep,
    requestId: string,
  ): Promise<void> {
    const now = this.clock.now();
    const locked = await this.prisma.$transaction(async (tx) => {
      const account = await tx.adminAccount.update({
        where: { id: accountId },
        data: { failedAuthAttemptCount: { increment: 1 } },
        select: { failedAuthAttemptCount: true },
      });
      await this.audit.record(tx, {
        actorType: 'ANONYMOUS',
        accessPath: 'SSM_PORT_FORWARD',
        action: 'LOGIN',
        targetType: 'ADMIN_ACCOUNT',
        targetId: accountId,
        result: 'FAILED',
        requestId,
        metadata: { step },
      });
      if (!shouldLock(account.failedAuthAttemptCount)) {
        return false;
      }
      await tx.adminAccount.update({
        where: { id: accountId },
        data: { failedAuthAttemptCount: 0, lockedUntil: addMs(now, LOCKOUT_DURATION_MS) },
      });
      await this.sessions.revokeAllForAccount(tx, accountId, 'ACCOUNT_LOCKED', now);
      await this.audit.record(tx, {
        actorType: 'SYSTEM',
        action: 'ACCOUNT_LOCKED',
        targetType: 'ADMIN_ACCOUNT',
        targetId: accountId,
        result: 'SUCCEEDED',
        requestId,
        metadata: { lockMinutes: LOCKOUT_DURATION_MS / 60_000 },
      });
      return true;
    });
    if (locked) {
      this.metrics.securityEvent('account_locked');
    }
  }
}
