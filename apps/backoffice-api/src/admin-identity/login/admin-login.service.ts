import { lockAdminAccountRow } from '@repo/database/sql';
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
type LoginStep = 'password' | SecondFactorStep;

/**
 * What one attempt decided under the account lock: the factor passed, a factor was wrong (counted
 * toward the lock), or nothing was tried (the challenge was already used).
 */
type AttemptResult<T> =
  | { readonly kind: 'passed'; readonly value: T }
  | { readonly kind: 'failed' }
  | { readonly kind: 'refused' };

interface LoginChallenge {
  readonly id: string;
  readonly accountId: string;
  readonly challenge: string;
}

// Attempts on one account wait for each other on its row lock; a burst queues for a few seconds
// at most (the login routes allow 30 attempts a minute in all).
const ATTEMPT_TRANSACTION = { maxWait: 10_000, timeout: 10_000 } as const;

export function totpAssociatedData(accountId: string): string {
  return `admin-totp:${accountId}`;
}

/**
 * Two-step login (OA-R2, OA-R5). The password step answers the same way for an unknown,
 * locked or deactivated account and a wrong password. A correct password opens one five-minute
 * challenge that one second-factor attempt consumes: a passkey gives a full session, a TOTP or
 * recovery code gives a recovery-scope session.
 *
 * Every attempt on a known account runs in one transaction that first locks the account row, so
 * concurrent attempts see the failures and the lock the earlier ones committed: at most five wrong
 * factors are checked before the lock, and none after it.
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
    const account = await this.prisma.adminAccount.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        status: true,
        passwordCredential: { select: { passwordHash: true } },
      },
    });
    if (!account || account.status !== 'ACTIVE' || !account.passwordCredential) {
      await this.passwords.verifyDummy(input.password);
      await this.recordAnonymousFailure(requestId);
      throw new BackofficeApiError('authentication_failed');
    }
    const accountId = account.id;
    const passwordHash = account.passwordCredential.passwordHash;
    return this.attempt<PasswordStepResult>(accountId, 'password', requestId, {
      whileLocked: () => this.passwords.verifyDummy(input.password),
      run: async (tx, now) => {
        if (!(await this.passwords.verify(passwordHash, input.password))) {
          return { kind: 'failed' };
        }
        const factors = await tx.adminAccount.findUniqueOrThrow({
          where: { id: accountId },
          select: {
            passkeyCredentials: { select: { credentialId: true } },
            totpCredential: { select: { confirmedAt: true } },
            recoveryCodes: { where: { usedAt: null }, select: { id: true } },
          },
        });
        const options = await this.webauthn.authenticationOptions(
          factors.passkeyCredentials.map((passkey) => passkey.credentialId),
        );
        const challenge = await tx.adminWebAuthnChallenge.create({
          data: {
            purpose: 'AUTHENTICATION',
            challenge: options.challenge,
            accountId,
            expiresAt: addMs(now, WEBAUTHN_CHALLENGE_TTL_MS),
          },
          select: { id: true },
        });
        return {
          kind: 'passed',
          value: {
            challengeId: challenge.id,
            options,
            recovery: {
              totp: factors.totpCredential?.confirmedAt != null,
              recoveryCode: factors.recoveryCodes.length > 0,
            },
          },
        };
      },
    });
  }

  async passkeyStep(input: LoginPasskeyRequest, requestId: string): Promise<IssuedSession> {
    const challenge = await this.loginChallenge(input.challengeId);
    const { accountId } = challenge;
    return this.attempt<IssuedSession>(accountId, 'passkey', requestId, {
      run: async (tx, now) => {
        if (!(await this.consumeChallenge(tx, challenge.id, now))) {
          return { kind: 'refused' };
        }
        const passkey = await tx.adminPasskeyCredential.findFirst({
          where: { accountId, credentialId: input.credential.id },
          select: {
            id: true,
            credentialId: true,
            publicKey: true,
            counter: true,
            transports: true,
          },
        });
        const verified = passkey
          ? await this.webauthn.verifyAuthentication(input.credential, challenge.challenge, passkey)
          : null;
        if (!passkey || !verified) {
          return { kind: 'failed' };
        }
        await tx.adminPasskeyCredential.update({
          where: { id: passkey.id },
          data: { counter: BigInt(verified.newCounter), lastUsedAt: now },
        });
        return {
          kind: 'passed',
          value: await this.openSession(tx, accountId, 'FULL', 'passkey', requestId, now),
        };
      },
    });
  }

  async totpStep(input: LoginTotpRequest, requestId: string): Promise<IssuedSession> {
    const challenge = await this.loginChallenge(input.challengeId);
    const { accountId } = challenge;
    const session = await this.attempt<IssuedSession>(accountId, 'totp', requestId, {
      run: async (tx, now) => {
        if (!(await this.consumeChallenge(tx, challenge.id, now))) {
          return { kind: 'refused' };
        }
        const credential = await tx.adminTotpCredential.findUnique({
          where: { accountId },
          select: { secretCiphertext: true, lastUsedTimeStep: true, confirmedAt: true },
        });
        const result =
          credential?.confirmedAt != null
            ? verifyTotp({
                secret: this.secretBox.open(
                  credential.secretCiphertext,
                  totpAssociatedData(accountId),
                ),
                code: input.code,
                at: now,
                lastUsedStep:
                  credential.lastUsedTimeStep === null ? null : Number(credential.lastUsedTimeStep),
              })
            : ({ ok: false } as const);
        if (!result.ok) {
          return { kind: 'failed' };
        }
        // A code is used once: a later attempt in the same time step reads this step and fails.
        await tx.adminTotpCredential.update({
          where: { accountId },
          data: { lastUsedTimeStep: BigInt(result.step) },
        });
        return {
          kind: 'passed',
          value: await this.openSession(tx, accountId, 'RECOVERY', 'totp', requestId, now),
        };
      },
    });
    this.metrics.securityEvent('recovery_login');
    return session;
  }

  async recoveryCodeStep(
    input: LoginRecoveryCodeRequest,
    requestId: string,
  ): Promise<IssuedSession> {
    const challenge = await this.loginChallenge(input.challengeId);
    const { accountId } = challenge;
    const session = await this.attempt<IssuedSession>(accountId, 'recovery_code', requestId, {
      run: async (tx, now) => {
        if (!(await this.consumeChallenge(tx, challenge.id, now))) {
          return { kind: 'refused' };
        }
        const used = await tx.adminRecoveryCode.updateMany({
          where: { accountId, codeHash: hashRecoveryCode(input.code), usedAt: null },
          data: { usedAt: now },
        });
        if (used.count !== 1) {
          return { kind: 'failed' };
        }
        return {
          kind: 'passed',
          value: await this.openSession(tx, accountId, 'RECOVERY', 'recovery_code', requestId, now),
        };
      },
    });
    this.metrics.securityEvent('recovery_login');
    return session;
  }

  /**
   * Runs one attempt on a known account under its row lock. A locked or no longer active account
   * gets the same answer without the factor being checked; a wrong factor is counted, and the
   * fifth consecutive one locks the account (OA-R5). The answer is thrown after the commit, so the
   * count and the lock survive it.
   */
  private async attempt<T>(
    accountId: string,
    step: LoginStep,
    requestId: string,
    handlers: {
      readonly run: (tx: BackofficeTransaction, now: Date) => Promise<AttemptResult<T>>;
      readonly whileLocked?: () => Promise<unknown>;
    },
  ): Promise<T> {
    const now = this.clock.now();
    const outcome = await this.prisma.$transaction(
      async (tx): Promise<{ result: AttemptResult<T>; locked: boolean }> => {
        const [account] = await tx.$queryRawTyped(lockAdminAccountRow(accountId));
        if (!account || account.status !== 'ACTIVE') {
          return { result: { kind: 'refused' }, locked: false };
        }
        if (isLocked(account.lockedUntil, now)) {
          await handlers.whileLocked?.();
          await this.recordLockedAttempt(tx, accountId, step, requestId);
          return { result: { kind: 'refused' }, locked: false };
        }
        const result = await handlers.run(tx, now);
        if (result.kind !== 'failed') {
          return { result, locked: false };
        }
        return { result, locked: await this.countFailure(tx, accountId, step, requestId, now) };
      },
      ATTEMPT_TRANSACTION,
    );
    if (outcome.locked) {
      this.metrics.securityEvent('account_locked');
    }
    if (outcome.result.kind !== 'passed') {
      throw new BackofficeApiError('authentication_failed');
    }
    return outcome.result.value;
  }

  /** The login challenge a password step opened; checked again when it is consumed. */
  private async loginChallenge(challengeId: string): Promise<LoginChallenge> {
    const row = await this.prisma.adminWebAuthnChallenge.findUnique({
      where: { id: challengeId },
      select: {
        id: true,
        purpose: true,
        challenge: true,
        accountId: true,
        sessionId: true,
        expiresAt: true,
        usedAt: true,
      },
    });
    if (
      !row ||
      row.purpose !== 'AUTHENTICATION' ||
      row.accountId === null ||
      row.sessionId !== null ||
      row.usedAt !== null ||
      row.expiresAt.getTime() <= this.clock.now().getTime()
    ) {
      throw new BackofficeApiError('authentication_failed');
    }
    return { id: row.id, accountId: row.accountId, challenge: row.challenge };
  }

  /** One attempt per password step: the challenge is used whether the factor passes or not. */
  private async consumeChallenge(
    tx: BackofficeTransaction,
    challengeId: string,
    now: Date,
  ): Promise<boolean> {
    const consumed = await tx.adminWebAuthnChallenge.updateMany({
      where: { id: challengeId, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    return consumed.count === 1;
  }

  private async openSession(
    tx: BackofficeTransaction,
    accountId: string,
    scope: 'FULL' | 'RECOVERY',
    method: SecondFactorStep,
    requestId: string,
    now: Date,
  ): Promise<IssuedSession> {
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

  private async recordLockedAttempt(
    tx: BackofficeTransaction,
    accountId: string,
    step: LoginStep,
    requestId: string,
  ): Promise<void> {
    await this.audit.record(tx, {
      actorType: 'ANONYMOUS',
      accessPath: 'SSM_PORT_FORWARD',
      action: 'LOGIN',
      targetType: 'ADMIN_ACCOUNT',
      targetId: accountId,
      result: 'DENIED',
      requestId,
      metadata: { step, locked: true },
    });
  }

  /**
   * Counts a failed password or second factor. The fifth consecutive failure locks the account
   * for 15 minutes, ends its sessions and restarts the count. Returns whether it locked.
   */
  private async countFailure(
    tx: BackofficeTransaction,
    accountId: string,
    step: LoginStep,
    requestId: string,
    now: Date,
  ): Promise<boolean> {
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
  }
}
