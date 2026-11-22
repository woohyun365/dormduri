import { lockAdminAccountRow, lockAdminSessionRow } from '@repo/database/sql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { issueBootstrapOwnerInvitation } from '../../src/admin-identity/bootstrap/bootstrap-owner.js';
import { totpAt } from '../../src/admin-identity/crypto/totp.js';
import { AdminAuditWriter } from '../../src/audit/admin-audit-writer.js';
import {
  auditActions,
  bearer,
  bootstrapOwner,
  inviteOperator,
  loginWithPasskey,
  passwordStep,
  reauthenticate,
  startBackofficeTestApp,
  TEST_PASSWORD,
  type BackofficeTestApp,
  type RegisteredOperator,
} from '../support/backoffice-test-app.js';
import {
  createIntegrationSandbox,
  type IntegrationSandbox,
} from '../support/integration-database.js';
import { SoftwareAuthenticator } from '../support/software-authenticator.js';

const base32Decode = (value: string): Buffer => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];
  for (const character of value) {
    buffer = (buffer << 5) | alphabet.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

describe('backoffice login, sessions and recovery (OA-R2~OA-R5)', () => {
  let sandbox: IntegrationSandbox;
  let test: BackofficeTestApp;
  let owner: RegisteredOperator;

  beforeAll(async () => {
    sandbox = await createIntegrationSandbox('bo_auth');
    test = await startBackofficeTestApp(sandbox);
    owner = await bootstrapOwner(test);
  });

  afterAll(async () => {
    await test?.close();
    await sandbox?.cleanup();
  });

  beforeEach(async () => {
    // Leave the process-wide login rate window between tests; tests move the clock past the idle
    // limit, so the owner logs in again.
    test.clock.advance(61_000);
    owner = { ...owner, token: await loginWithPasskey(test, owner) };
  });

  it('bootstraps the first owner through a one-time code and records it from the first row', async () => {
    const session = await test.http.get('/auth/session').set(bearer(owner.token)).expect(200);
    expect(session.body).toMatchObject({
      scope: 'FULL',
      roles: ['OWNER'],
      permissions: [
        'admin:access:approve',
        'admin:access:request',
        'admin:account:deactivate',
        'admin:account:invite',
        'admin:audit:read',
        'admin:audit:review',
      ],
      totpConfirmed: false,
      recoveryCodesRemaining: 10,
      passkeyCount: 1,
    });
    // Rows of one transaction share the database transaction time, so the registration rows are
    // compared as a set after the bootstrap row of the earlier transaction.
    const actions = await auditActions(sandbox);
    expect(actions[0]).toBe('BOOTSTRAP_OWNER');
    expect(actions.slice(1, 7).sort()).toEqual(
      [
        'INVITATION_ACCEPT',
        'ROLE_GRANT',
        'PASSKEY_REGISTER',
        'TOTP_ENROLL',
        'RECOVERY_CODES_ISSUE',
        'LOGIN',
      ].sort(),
    );
    const { rows } = await sandbox.admin.query<{ actorType: string; grantedBy: string | null }>(
      `SELECT e."actorType", a."grantedByApprovalRequestId" AS "grantedBy"
       FROM ${sandbox.table('AdminAuditEvent')} e
       JOIN ${sandbox.table('AdminRoleAssignment')} a ON a."id" = e."targetId"
       WHERE e."action" = 'ROLE_GRANT'`,
    );
    expect(rows).toEqual([{ actorType: 'SYSTEM', grantedBy: null }]);
  });

  it('refuses the bootstrap command while an active account exists', async () => {
    await expect(
      issueBootstrapOwnerInvitation(
        { prisma: test.prisma, audit: test.app.get(AdminAuditWriter), clock: test.clock },
        { email: 'second-owner@backoffice.test', displayName: 'Second' },
      ),
    ).rejects.toThrow(/active backoffice account/u);
  });

  it('logs in with password then passkey, and a logout ends the session at once', async () => {
    const token = await loginWithPasskey(test, owner);
    await test.http.get('/auth/session').set(bearer(token)).expect(200);
    await test.http.post('/auth/logout').set(bearer(token)).expect(204);
    const after = await test.http.get('/auth/session').set(bearer(token)).expect(401);
    expect(after.body).toMatchObject({ error: { code: 'session_required' } });
  });

  it('answers an unknown email, a wrong password and a deactivated account the same way', async () => {
    const leaver = await inviteOperator(test, owner, 'same-answer@backoffice.test');
    await reauthenticate(test, owner);
    await test.http
      .post(`/accounts/${leaver.accountId}/deactivate`)
      .set(bearer(owner.token))
      .send({ reason: 'left the team' })
      .expect(204);
    const unknown = await passwordStep(test, 'nobody@backoffice.test').expect(401);
    const wrong = await passwordStep(test, owner.email, 'wrong password value').expect(401);
    const deactivated = await passwordStep(test, leaver.email).expect(401);
    for (const answer of [unknown, wrong, deactivated]) {
      expect(answer.body.error.code).toBe('authentication_failed');
      expect(Object.keys(answer.body.error)).toEqual(Object.keys(wrong.body.error));
    }
  });

  it('locks the account for 15 minutes on the fifth consecutive failure and ends its sessions', async () => {
    const victim = await inviteOperator(test, owner, 'lock@backoffice.test');
    const liveToken = await loginWithPasskey(test, victim);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await passwordStep(test, victim.email, 'wrong password value').expect(401);
    }
    // The correct password is refused while locked, with the same answer.
    const locked = await passwordStep(test, victim.email).expect(401);
    expect(locked.body.error.code).toBe('authentication_failed');
    await test.http.get('/auth/session').set(bearer(liveToken)).expect(401);
    const { rows } = await sandbox.admin.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM ${sandbox.table('AdminAuditEvent')}
       WHERE "action" = 'ACCOUNT_LOCKED' AND "targetId" = $1`,
      [victim.accountId],
    );
    expect(rows[0]?.count).toBe(1);
    expect(await test.metrics.render()).toMatch(
      /backoffice_security_events_total\{event="account_locked"[^}]*\} 1/u,
    );

    test.clock.advance(15 * 60_000);
    await loginWithPasskey(test, victim);
  });

  it('checks at most five wrong passwords before the lock, even when they arrive together', async () => {
    const victim = await inviteOperator(test, owner, 'burst@backoffice.test');
    const answers = await Promise.all(
      Array.from({ length: 8 }, () => passwordStep(test, victim.email, 'wrong password value')),
    );
    expect(answers.map((answer) => answer.status)).toEqual(Array.from({ length: 8 }, () => 401));
    // Attempts wait on the account row: five are checked and counted, the rest meet the lock.
    const { rows } = await sandbox.admin.query<{ result: string; count: number }>(
      `SELECT "result", COUNT(*)::int AS count FROM ${sandbox.table('AdminAuditEvent')}
       WHERE "action" = 'LOGIN' AND "targetId" = $1 GROUP BY "result" ORDER BY "result"`,
      [victim.accountId],
    );
    expect(rows).toEqual([
      { result: 'DENIED', count: 3 },
      { result: 'FAILED', count: 5 },
    ]);
    await passwordStep(test, victim.email).expect(401);
  });

  it('counts wrong second factors toward the same lock', async () => {
    const victim = await inviteOperator(test, owner, 'factors@backoffice.test');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const step = await passwordStep(test, victim.email).expect(200);
      await test.http
        .post('/auth/login/recovery-code')
        .send({ challengeId: step.body.challengeId, code: 'AAAAA-BBBBB' })
        .expect(401);
    }
    await passwordStep(test, victim.email).expect(401);
    const { rows } = await sandbox.admin.query<{ step: string; count: number }>(
      `SELECT "metadata"->>'step' AS step, COUNT(*)::int AS count FROM ${sandbox.table('AdminAuditEvent')}
       WHERE "action" = 'LOGIN' AND "result" = 'FAILED' AND "targetId" = $1 GROUP BY 1`,
      [victim.accountId],
    );
    expect(rows).toEqual([{ step: 'recovery_code', count: 5 }]);
  });

  it('turns a TOTP login into a recovery session that may only add a passkey and log out', async () => {
    const operator = await inviteOperator(test, owner, 'recovery@backoffice.test');
    const secret = base32Decode(operator.totpSecret);
    await test.http
      .post('/auth/totp/confirm')
      .set(bearer(operator.token))
      .send({ code: totpAt(secret, test.clock.now()) })
      .expect(204);

    test.clock.advance(61_000);
    const step = await passwordStep(test, operator.email).expect(200);
    expect(step.body.recovery).toEqual({ totp: true, recoveryCode: true });
    const totpLogin = await test.http
      .post('/auth/login/totp')
      .send({ challengeId: step.body.challengeId, code: totpAt(secret, test.clock.now()) })
      .expect(200);
    const recoveryToken = totpLogin.body.session.token as string;
    expect(totpLogin.body.session.scope).toBe('RECOVERY');

    const denied = await test.http
      .post('/auth/reauthentication/options')
      .set(bearer(recoveryToken))
      .expect(403);
    expect(denied.body.error.code).toBe('recovery_scope');
    await test.http.get('/access/roles').set(bearer(recoveryToken)).expect(403);
    const info = await test.http.get('/auth/session').set(bearer(recoveryToken)).expect(200);
    expect(info.body.permissions).toEqual([]);

    // A new passkey from the recovery session, then a normal login with it.
    const replacement = new SoftwareAuthenticator();
    const options = await test.http
      .post('/auth/passkeys/options')
      .set(bearer(recoveryToken))
      .expect(200);
    await test.http
      .post('/auth/passkeys')
      .set(bearer(recoveryToken))
      .send({
        challengeId: options.body.challengeId,
        credential: replacement.register(options.body.options),
      })
      .expect(200);
    await loginWithPasskey(test, { email: operator.email, authenticator: replacement });
    expect(await test.metrics.render()).toMatch(
      /backoffice_security_events_total\{event="recovery_login"[^}]*\} [1-9]/u,
    );
  });

  it('refuses a TOTP code from the step it was already used in', async () => {
    const operator = await inviteOperator(test, owner, 'replay@backoffice.test');
    const secret = base32Decode(operator.totpSecret);
    const code = totpAt(secret, test.clock.now());
    await test.http
      .post('/auth/totp/confirm')
      .set(bearer(operator.token))
      .send({ code })
      .expect(204);
    const step = await passwordStep(test, operator.email).expect(200);
    await test.http
      .post('/auth/login/totp')
      .send({ challengeId: step.body.challengeId, code })
      .expect(401);
  });

  it('uses a recovery code once', async () => {
    const operator = await inviteOperator(test, owner, 'codes@backoffice.test');
    const [code] = operator.recoveryCodes;
    const first = await passwordStep(test, operator.email).expect(200);
    const login = await test.http
      .post('/auth/login/recovery-code')
      .send({ challengeId: first.body.challengeId, code })
      .expect(200);
    expect(login.body.session.scope).toBe('RECOVERY');
    const second = await passwordStep(test, operator.email).expect(200);
    await test.http
      .post('/auth/login/recovery-code')
      .send({ challengeId: second.body.challengeId, code })
      .expect(401);
  });

  it('uses one login challenge for one second-factor attempt', async () => {
    const step = await passwordStep(test, owner.email).expect(200);
    const credential = owner.authenticator.authenticate(step.body.options);
    await test.http
      .post('/auth/login/passkey')
      .send({ challengeId: step.body.challengeId, credential })
      .expect(200);
    await test.http
      .post('/auth/login/passkey')
      .send({ challengeId: step.body.challengeId, credential })
      .expect(401);
  });

  it('refuses a passkey answer made without user verification, and counts it', async () => {
    const operator = await inviteOperator(test, owner, 'unverified@backoffice.test');
    const step = await passwordStep(test, operator.email).expect(200);
    await test.http
      .post('/auth/login/passkey')
      .send({
        challengeId: step.body.challengeId,
        credential: operator.authenticator.authenticate(step.body.options, { userVerified: false }),
      })
      .expect(401);
    const { rows } = await sandbox.admin.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM ${sandbox.table('AdminAuditEvent')}
       WHERE "action" = 'LOGIN' AND "result" = 'FAILED' AND "targetId" = $1 AND "metadata"->>'step' = 'passkey'`,
      [operator.accountId],
    );
    expect(rows[0]?.count).toBe(1);
  });

  it('refuses a passkey answer for another origin', async () => {
    const step = await passwordStep(test, owner.email).expect(200);
    const foreign = new SoftwareAuthenticator({ origin: 'http://localhost:3000' });
    await test.http
      .post('/auth/login/passkey')
      .send({
        challengeId: step.body.challengeId,
        credential: foreign.authenticate(step.body.options),
      })
      .expect(401);
  });

  it('holds the account and session row locks without blocking audit rows that reference them', async () => {
    // A re-authentication holds its passkey row and then writes an audit row; a login attempt holds
    // the account row and then updates that passkey. If the account lock blocked the audit row's
    // foreign key check, the two would deadlock.
    const { rows: sessions } = await sandbox.admin.query<{ id: string }>(
      `SELECT "id" FROM ${sandbox.table('AdminSession')} WHERE "accountId" = $1 AND "revokedAt" IS NULL LIMIT 1`,
      [owner.accountId],
    );
    const sessionId = sessions[0]?.id;
    expect(sessionId).toBeDefined();
    await test.prisma.$transaction(async (tx) => {
      await tx.$queryRawTyped(lockAdminAccountRow(owner.accountId));
      await tx.$queryRawTyped(lockAdminSessionRow(sessionId!));
      await sandbox.admin.query(`SET lock_timeout = '2s'`);
      try {
        await sandbox.admin.query(
          `INSERT INTO ${sandbox.table('AdminAuditEvent')} ("id", "actorType", "actorAccountId", "sessionId", "action", "result")
           VALUES (gen_random_uuid()::text, 'ADMIN', $1, $2, 'REAUTHENTICATE', 'SUCCEEDED')`,
          [owner.accountId, sessionId],
        );
      } finally {
        await sandbox.admin.query('RESET lock_timeout');
      }
    });
  });

  it('ends a session after 15 idle minutes and 8 hours after login, auditing the expiry once', async () => {
    const idle = await loginWithPasskey(test, owner);
    test.clock.advance(14 * 60_000);
    await test.http.get('/auth/session').set(bearer(idle)).expect(200);
    test.clock.advance(15 * 60_000);
    // Requests on the expired session at once still leave one expiry row (its row lock).
    const expired = await Promise.all(
      Array.from({ length: 4 }, () => test.http.get('/auth/session').set(bearer(idle))),
    );
    expect(
      expired.map((answer) => [
        answer.status,
        (answer.body as { error: { code: string } }).error.code,
      ]),
    ).toEqual(Array.from({ length: 4 }, () => [401, 'session_expired']));
    const { rows } = await sandbox.admin.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM ${sandbox.table('AdminAuditEvent')} e
       JOIN ${sandbox.table('AdminSession')} s ON s."id" = e."targetId"
       WHERE e."action" = 'SESSION_EXPIRED' AND s."tokenHash" = encode(sha256(convert_to($1, 'UTF8')), 'hex')`,
      [idle],
    );
    expect(rows[0]?.count).toBe(1);

    const busy = await loginWithPasskey(test, owner);
    for (let minutes = 0; minutes < 8 * 60 - 10; minutes += 10) {
      test.clock.advance(10 * 60_000);
      await test.http.get('/auth/session').set(bearer(busy)).expect(200);
    }
    test.clock.advance(10 * 60_000);
    await test.http.get('/auth/session').set(bearer(busy)).expect(401);
  });

  it('needs a passkey re-authentication in the last five minutes for an approval route', async () => {
    const token = await loginWithPasskey(test, owner);
    const operator = { ...owner, token };
    const body = { kind: 'ROLE_GRANT', targetAccountId: owner.accountId, targetRole: 'AUDITOR' };
    const first = await test.http
      .post('/access/requests')
      .set(bearer(token))
      .send(body)
      .expect(403);
    expect(first.body.error.code).toBe('reauthentication_required');
    await reauthenticate(test, operator);
    await test.http.post('/access/requests').set(bearer(token)).send(body).expect(200);
    test.clock.advance(5 * 60_000);
    await test.http.post('/access/requests').set(bearer(token)).send(body).expect(403);
  });

  it('reissues TOTP and recovery codes after a passkey re-authentication, retiring the old ones', async () => {
    const operator = await inviteOperator(test, owner, 'reissue@backoffice.test');
    const oldSecret = base32Decode(operator.totpSecret);
    await test.http
      .post('/auth/totp/confirm')
      .set(bearer(operator.token))
      .send({ code: totpAt(oldSecret, test.clock.now()) })
      .expect(204);
    await test.http.post('/auth/totp').set(bearer(operator.token)).expect(403);
    await reauthenticate(test, operator);
    const totp = await test.http.post('/auth/totp').set(bearer(operator.token)).expect(200);
    const codes = await test.http
      .post('/auth/recovery-codes')
      .set(bearer(operator.token))
      .expect(200);
    const newCodes = codes.body.recoveryCodes as string[];
    expect(newCodes).toHaveLength(10);
    const info = await test.http.get('/auth/session').set(bearer(operator.token)).expect(200);
    expect(info.body).toMatchObject({ totpConfirmed: false, recoveryCodesRemaining: 10 });

    // The reissued TOTP waits for its confirmation, and the old recovery codes no longer log in.
    test.clock.advance(61_000);
    const step = await passwordStep(test, operator.email).expect(200);
    expect(step.body.recovery).toEqual({ totp: false, recoveryCode: true });
    await test.http
      .post('/auth/login/recovery-code')
      .send({ challengeId: step.body.challengeId, code: operator.recoveryCodes[0] })
      .expect(401);
    await test.http
      .post('/auth/totp/confirm')
      .set(bearer(operator.token))
      .send({ code: totpAt(base32Decode(totp.body.secret as string), test.clock.now()) })
      .expect(204);
    const login = await passwordStep(test, operator.email).expect(200);
    await test.http
      .post('/auth/login/recovery-code')
      .send({ challengeId: login.body.challengeId, code: newCodes[0] })
      .expect(200);
  });

  it('never stores a session token, invitation code or recovery code in clear', async () => {
    const { rows } = await sandbox.admin.query<{ joined: string }>(
      `SELECT string_agg(value, ' ') AS joined FROM (
         SELECT "tokenHash" AS value FROM ${sandbox.table('AdminSession')}
         UNION ALL SELECT "codeHash" FROM ${sandbox.table('AdminInvitation')}
         UNION ALL SELECT "codeHash" FROM ${sandbox.table('AdminRecoveryCode')}
         UNION ALL SELECT "secretCiphertext" FROM ${sandbox.table('AdminTotpCredential')}
         UNION ALL SELECT "passwordHash" FROM ${sandbox.table('AdminPasswordCredential')}
       ) stored`,
    );
    const stored = rows[0]?.joined ?? '';
    expect(stored).not.toContain(owner.token);
    expect(stored).not.toContain(owner.recoveryCodes[1]!);
    expect(stored).not.toContain(owner.totpSecret);
    expect(stored).not.toContain(TEST_PASSWORD);
  });
});
