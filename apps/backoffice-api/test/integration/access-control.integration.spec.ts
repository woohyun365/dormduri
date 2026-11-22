import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  bearer,
  bootstrapOwner,
  inviteOperator,
  loginWithPasskey,
  reauthenticate,
  startBackofficeTestApp,
  type BackofficeTestApp,
  type RegisteredOperator,
} from '../support/backoffice-test-app.js';
import {
  createIntegrationSandbox,
  type IntegrationSandbox,
} from '../support/integration-database.js';

interface RequestView {
  id: string;
  status: string;
  contentDigest: string;
  selfApproved: boolean;
  decidedByAccountId: string | null;
}

describe('roles, approval requests and separation of duties (OA-R6, OA-R9)', () => {
  let sandbox: IntegrationSandbox;
  let test: BackofficeTestApp;
  let owner: RegisteredOperator;
  let secondOwner: RegisteredOperator | null = null;

  const fresh = async (operator: RegisteredOperator): Promise<RegisteredOperator> => {
    const next = { ...operator, token: await loginWithPasskey(test, operator) };
    await reauthenticate(test, next);
    return next;
  };

  const requestRole = async (
    requester: RegisteredOperator,
    kind: 'ROLE_GRANT' | 'ROLE_REVOKE',
    target: RegisteredOperator,
    role: string,
  ): Promise<RequestView> => {
    const response = await test.http
      .post('/access/requests')
      .set(bearer(requester.token))
      .send({ kind, targetAccountId: target.accountId, targetRole: role })
      .expect(200);
    return response.body as RequestView;
  };

  beforeAll(async () => {
    sandbox = await createIntegrationSandbox('bo_access');
    test = await startBackofficeTestApp(sandbox);
    owner = await bootstrapOwner(test);
  });

  afterAll(async () => {
    await test?.close();
    await sandbox?.cleanup();
  });

  beforeEach(async () => {
    test.clock.advance(61_000);
    owner = await fresh(owner);
  });

  it('lets the sole approver approve their own request only with a reason, and marks it', async () => {
    const operator = await inviteOperator(test, owner, 'auditor@backoffice.test');
    const request = await requestRole(owner, 'ROLE_GRANT', operator, 'AUDITOR');

    const withoutReason = await test.http
      .post(`/access/requests/${request.id}/approve`)
      .set(bearer(owner.token))
      .send({ contentDigest: request.contentDigest })
      .expect(400);
    expect(withoutReason.body.error.code).toBe('invalid_request');

    const approved = await test.http
      .post(`/access/requests/${request.id}/approve`)
      .set(bearer(owner.token))
      .send({ contentDigest: request.contentDigest, reason: 'first operator setup' })
      .expect(200);
    expect(approved.body).toMatchObject({
      status: 'APPROVED',
      selfApproved: true,
      decidedByAccountId: owner.accountId,
    });
    const { rows } = await sandbox.admin.query<{ selfApproved: boolean; reason: string }>(
      `SELECT "selfApproved", "reason" FROM ${sandbox.table('AdminAuditEvent')}
       WHERE "action" = 'ACCESS_REQUEST_APPROVE' AND "approvalRequestId" = $1`,
      [request.id],
    );
    expect(rows).toEqual([{ selfApproved: true, reason: 'first operator setup' }]);
    expect(await test.metrics.render()).toMatch(
      /backoffice_security_events_total\{event="self_approval"[^}]*\} 1/u,
    );

    // The auditor now reads the audit list but cannot see accounts.
    const auditor = await fresh(operator);
    await test.http.get('/audit/events').set(bearer(auditor.token)).expect(200);
    const denied = await test.http.get('/accounts').set(bearer(auditor.token)).expect(403);
    expect(denied.body.error.code).toBe('permission_denied');
  });

  it('refuses to revoke the owner role of the last approver, even by self approval', async () => {
    const request = await requestRole(owner, 'ROLE_REVOKE', owner, 'OWNER');
    const refused = await test.http
      .post(`/access/requests/${request.id}/approve`)
      .set(bearer(owner.token))
      .send({ contentDigest: request.contentDigest, reason: 'leaving' })
      .expect(409);
    expect(refused.body.error.code).toBe('conflict');
    await test.http
      .post(`/access/requests/${request.id}/cancel`)
      .set(bearer(owner.token))
      .expect(200);
  });

  it('refuses a self approval once a second approver exists, and accepts the other approver', async () => {
    const second = await inviteOperator(test, owner, 'second-owner@backoffice.test');
    const grantOwner = await requestRole(owner, 'ROLE_GRANT', second, 'OWNER');
    await test.http
      .post(`/access/requests/${grantOwner.id}/approve`)
      .set(bearer(owner.token))
      .send({ contentDigest: grantOwner.contentDigest, reason: 'second owner' })
      .expect(200);

    const target = await inviteOperator(test, owner, 'editor@backoffice.test');
    const request = await requestRole(owner, 'ROLE_GRANT', target, 'LEGAL_EDITOR');
    const self = await test.http
      .post(`/access/requests/${request.id}/approve`)
      .set(bearer(owner.token))
      .send({ contentDigest: request.contentDigest, reason: 'still alone?' })
      .expect(403);
    expect(self.body.error.code).toBe('permission_denied');

    secondOwner = await fresh(second);
    const other = await test.http
      .post(`/access/requests/${request.id}/approve`)
      .set(bearer(secondOwner.token))
      .send({ contentDigest: request.contentDigest })
      .expect(200);
    expect(other.body).toMatchObject({ status: 'APPROVED', selfApproved: false });

    // Decided once: a second decision is a conflict.
    await test.http
      .post(`/access/requests/${request.id}/approve`)
      .set(bearer(secondOwner.token))
      .send({ contentDigest: request.contentDigest })
      .expect(409);
  });

  it('never lets a requester reject their own request; they cancel it', async () => {
    const target = await inviteOperator(test, owner, 'cancel@backoffice.test');
    const request = await requestRole(owner, 'ROLE_GRANT', target, 'AUDITOR');
    await test.http
      .post(`/access/requests/${request.id}/reject`)
      .set(bearer(owner.token))
      .send({ contentDigest: request.contentDigest, reason: 'no' })
      .expect(403);
    const cancelled = await test.http
      .post(`/access/requests/${request.id}/cancel`)
      .set(bearer(owner.token))
      .expect(200);
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', decidedByAccountId: null });
  });

  it('decides only the content the decider saw, and expires a request after seven days', async () => {
    const target = await inviteOperator(test, owner, 'digest@backoffice.test');
    const request = await requestRole(owner, 'ROLE_GRANT', target, 'AUDITOR');
    await test.http
      .post(`/access/requests/${request.id}/approve`)
      .set(bearer(owner.token))
      .send({ contentDigest: 'f'.repeat(64), reason: 'tampered' })
      .expect(409);

    test.clock.advance(7 * 24 * 60 * 60_000);
    owner = await fresh(owner);
    await test.http
      .post(`/access/requests/${request.id}/approve`)
      .set(bearer(owner.token))
      .send({ contentDigest: request.contentDigest, reason: 'late' })
      .expect(409);
    const { rows } = await sandbox.admin.query<{ status: string; closed: boolean }>(
      `SELECT "status", "closedAt" IS NOT NULL AS closed FROM ${sandbox.table('AdminApprovalRequest')} WHERE "id" = $1`,
      [request.id],
    );
    expect(rows).toEqual([{ status: 'EXPIRED', closed: true }]);
  });

  it('grants and revokes a role through requests, ending the target sessions at once', async () => {
    expect(secondOwner).not.toBeNull();
    const decider = await fresh(secondOwner!);
    secondOwner = decider;
    const target = await inviteOperator(test, owner, 'revoke@backoffice.test');
    const grant = await requestRole(owner, 'ROLE_GRANT', target, 'AUDITOR');
    await test.http
      .post(`/access/requests/${grant.id}/approve`)
      .set(bearer(decider.token))
      .send({ contentDigest: grant.contentDigest })
      .expect(200);
    const targetToken = await loginWithPasskey(test, target);
    await test.http.get('/audit/events').set(bearer(targetToken)).expect(200);

    const revoke = await requestRole(owner, 'ROLE_REVOKE', target, 'AUDITOR');
    await test.http
      .post(`/access/requests/${revoke.id}/approve`)
      .set(bearer(decider.token))
      .send({ contentDigest: revoke.contentDigest })
      .expect(200);
    const ended = await test.http.get('/auth/session').set(bearer(targetToken)).expect(401);
    expect(ended.body.error.code).toBe('session_required');
    const { rows } = await sandbox.admin.query<{ revoked: boolean; revokedBy: string | null }>(
      `SELECT "revokedAt" IS NOT NULL AS revoked, "revokedByApprovalRequestId" AS "revokedBy"
       FROM ${sandbox.table('AdminRoleAssignment')} WHERE "accountId" = $1`,
      [target.accountId],
    );
    expect(rows).toEqual([{ revoked: true, revokedBy: revoke.id }]);
    const relogin = await fresh(target);
    await test.http.get('/audit/events').set(bearer(relogin.token)).expect(403);
  });

  it('deactivates an account: credentials gone, sessions and roles ended, row and audit kept', async () => {
    const target = await inviteOperator(test, owner, 'leaver@backoffice.test');
    const targetToken = await loginWithPasskey(test, target);
    await sandbox.admin.query(
      `INSERT INTO ${sandbox.table('AdminRoleAssignment')} ("id", "accountId", "role") VALUES ($1, $2, 'AUDITOR')`,
      [randomUUID(), target.accountId],
    );
    const self = await test.http
      .post(`/accounts/${owner.accountId}/deactivate`)
      .set(bearer(owner.token))
      .send({ reason: 'self' })
      .expect(409);
    expect(self.body.error.code).toBe('conflict');

    await test.http
      .post(`/accounts/${target.accountId}/deactivate`)
      .set(bearer(owner.token))
      .send({ reason: 'left the team' })
      .expect(204);
    await test.http.get('/auth/session').set(bearer(targetToken)).expect(401);
    const counts = await sandbox.admin.query<Record<string, number>>(
      `SELECT
         (SELECT COUNT(*)::int FROM ${sandbox.table('AdminPasswordCredential')} WHERE "accountId" = $1) AS passwords,
         (SELECT COUNT(*)::int FROM ${sandbox.table('AdminPasskeyCredential')} WHERE "accountId" = $1) AS passkeys,
         (SELECT COUNT(*)::int FROM ${sandbox.table('AdminTotpCredential')} WHERE "accountId" = $1) AS totp,
         (SELECT COUNT(*)::int FROM ${sandbox.table('AdminRecoveryCode')} WHERE "accountId" = $1) AS codes,
         (SELECT COUNT(*)::int FROM ${sandbox.table('AdminRoleAssignment')} WHERE "accountId" = $1 AND "revokedAt" IS NULL) AS roles,
         (SELECT COUNT(*)::int FROM ${sandbox.table('AdminSession')} WHERE "accountId" = $1 AND "revokedAt" IS NULL) AS sessions,
         (SELECT COUNT(*)::int FROM ${sandbox.table('AdminAccount')} WHERE "id" = $1 AND "status" = 'DEACTIVATED') AS accounts`,
      [target.accountId],
    );
    expect(counts.rows[0]).toEqual({
      passwords: 0,
      passkeys: 0,
      totp: 0,
      codes: 0,
      roles: 0,
      sessions: 0,
      accounts: 1,
    });
  });

  it('lists accounts and requests, revokes an invitation and records the monthly review', async () => {
    const invitation = await test.http
      .post('/accounts/invitations')
      .set(bearer(owner.token))
      .send({ email: 'revoked@backoffice.test', displayName: 'Revoked' })
      .expect(200);
    const listed = await test.http.get('/accounts').set(bearer(owner.token)).expect(200);
    const body = listed.body as { accounts: { id: string }[]; invitations: { id: string }[] };
    expect(body.accounts.map((account) => account.id)).toContain(owner.accountId);
    expect(body.invitations.map((pending) => pending.id)).toContain(invitation.body.invitationId);
    await test.http
      .post(`/accounts/invitations/${invitation.body.invitationId}/revoke`)
      .set(bearer(owner.token))
      .expect(204);
    await test.http
      .post('/auth/registration/options')
      .send({ code: invitation.body.code })
      .expect(401);

    const requests = await test.http.get('/access/requests').set(bearer(owner.token)).expect(200);
    expect(Array.isArray(requests.body.requests)).toBe(true);

    await test.http
      .post('/audit/reviews')
      .set(bearer(owner.token))
      .send({ note: 'monthly review' })
      .expect(200);
    const events = await test.http
      .get('/audit/events?limit=5')
      .set(bearer(owner.token))
      .expect(200);
    expect(events.body.events[0]).toMatchObject({
      action: 'AUDIT_REVIEW',
      actorAccountId: owner.accountId,
    });
  });

  it('rolls the action back when its audit row cannot be written (OA-R7)', async () => {
    await sandbox.admin.query(
      `REVOKE INSERT ON ${sandbox.table('AdminAuditEvent')} FROM backoffice_runtime`,
    );
    try {
      const failed = await test.http
        .post('/accounts/invitations')
        .set(bearer(owner.token))
        .send({ email: 'rollback@backoffice.test', displayName: 'Rollback' })
        .expect(500);
      expect(failed.body.error.code).toBe('internal_error');
    } finally {
      await sandbox.admin.query(
        `GRANT INSERT ("id", "actorType", "actorAccountId", "sessionId", "accessPath", "action", "targetType", "targetId", "approvalRequestId", "result", "selfApproved", "reason", "requestId", "metadata") ON ${sandbox.table('AdminAuditEvent')} TO backoffice_runtime`,
      );
    }
    const { rows } = await sandbox.admin.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM ${sandbox.table('AdminInvitation')} WHERE "email" = 'rollback@backoffice.test'`,
    );
    expect(rows[0]?.count).toBe(0);
    expect(await test.metrics.render()).toMatch(
      /backoffice_security_events_total\{event="audit_write_failed"[^}]*\} [1-9]/u,
    );
  });

  it('keeps the decider, status and self-approval flag consistent in the database', async () => {
    const target = await inviteOperator(test, owner, 'checks@backoffice.test');
    const request = await requestRole(owner, 'ROLE_GRANT', target, 'AUDITOR');
    const update = (set: string) =>
      sandbox.admin.query(
        `UPDATE ${sandbox.table('AdminApprovalRequest')} SET ${set}, "closedAt" = now() WHERE "id" = $1`,
        [request.id],
      );
    // Approved without a decider.
    await expect(update(`"status" = 'APPROVED'`)).rejects.toThrow(
      /AdminApprovalRequest_decider_check/u,
    );
    // Approved by the requester without the self-approval flag.
    await expect(
      update(`"status" = 'APPROVED', "decidedByAccountId" = "requestedByAccountId"`),
    ).rejects.toThrow(/AdminApprovalRequest_self_approval_check/u);
    // The flag on an approval by another account.
    await expect(
      update(
        `"status" = 'APPROVED', "decidedByAccountId" = '${target.accountId}', "selfApproved" = true`,
      ),
    ).rejects.toThrow(/AdminApprovalRequest_self_approval_check/u);
    // Rejected by the requester.
    await expect(
      update(`"status" = 'REJECTED', "decidedByAccountId" = "requestedByAccountId"`),
    ).rejects.toThrow(/AdminApprovalRequest_reject_by_other_check/u);
    // Cancelled with a decider.
    await expect(
      update(`"status" = 'CANCELLED', "decidedByAccountId" = '${target.accountId}'`),
    ).rejects.toThrow(/AdminApprovalRequest_decider_check/u);
  });

  it('pages the audit and request lists by time and id, keeping rows of one transaction', async () => {
    const pageThrough = async (path: string, key: 'events' | 'requests'): Promise<string[]> => {
      const ids: string[] = [];
      let next: { beforeTime: string; beforeId: string } | null = null;
      do {
        const cursor: string = next
          ? `&beforeTime=${encodeURIComponent(next.beforeTime)}&beforeId=${next.beforeId}`
          : '';
        const page = await test.http
          .get(`${path}?limit=2${cursor}`)
          .set(bearer(owner.token))
          .expect(200);
        const body = page.body as Record<typeof key, { id: string }[]> & {
          nextPage: { beforeTime: string; beforeId: string } | null;
        };
        ids.push(...body[key].map((row) => row.id));
        next = body.nextPage;
      } while (next);
      return ids;
    };
    const ordered = async (table: string, time: string): Promise<string[]> =>
      (
        await sandbox.admin.query<{ id: string }>(
          `SELECT "id" FROM ${sandbox.table(table)} ORDER BY "${time}" DESC, "id" DESC`,
        )
      ).rows.map((row) => row.id);

    // The bootstrap registration alone wrote six audit rows at one database time.
    expect(await pageThrough('/audit/events', 'events')).toEqual(
      await ordered('AdminAuditEvent', 'occurredAt'),
    );
    expect(await pageThrough('/access/requests', 'requests')).toEqual(
      await ordered('AdminApprovalRequest', 'createdAt'),
    );
    const half = await test.http
      .get(`/audit/events?beforeId=${owner.accountId}`)
      .set(bearer(owner.token))
      .expect(400);
    expect(half.body.error.code).toBe('invalid_request');
  });

  it('lists a pending request past its expiry as EXPIRED before anyone decides it', async () => {
    const target = await inviteOperator(test, owner, 'late@backoffice.test');
    const request = await requestRole(owner, 'ROLE_GRANT', target, 'AUDITOR');
    test.clock.advance(7 * 24 * 60 * 60_000 + 60_000);
    owner = await fresh(owner);
    const listed = async (status: string) =>
      (
        (
          await test.http
            .get(`/access/requests?status=${status}&limit=100`)
            .set(bearer(owner.token))
            .expect(200)
        ).body as { requests: { id: string; status: string }[] }
      ).requests.filter((row) => row.id === request.id);
    expect(await listed('PENDING')).toEqual([]);
    expect(await listed('EXPIRED')).toMatchObject([{ id: request.id, status: 'EXPIRED' }]);
  });

  it('refuses a deactivation that would leave one approver; the role is revoked through a request', async () => {
    expect(secondOwner).not.toBeNull();
    const other = await fresh(secondOwner!);
    const refused = await test.http
      .post(`/accounts/${other.accountId}/deactivate`)
      .set(bearer(owner.token))
      .send({ reason: 'left the team' })
      .expect(409);
    expect(refused.body.error.code).toBe('conflict');
    const { rows: untouched } = await sandbox.admin.query<{ status: string; roles: number }>(
      `SELECT a."status", (SELECT COUNT(*)::int FROM ${sandbox.table('AdminRoleAssignment')} r
         WHERE r."accountId" = a."id" AND r."revokedAt" IS NULL AND r."role" = 'OWNER') AS roles
       FROM ${sandbox.table('AdminAccount')} a WHERE a."id" = $1`,
      [other.accountId],
    );
    expect(untouched).toEqual([{ status: 'ACTIVE', roles: 1 }]);

    // The requester cannot decide; the target operator may decide their own role revoke.
    const revoke = await requestRole(owner, 'ROLE_REVOKE', other, 'OWNER');
    await test.http
      .post(`/access/requests/${revoke.id}/approve`)
      .set(bearer(owner.token))
      .send({ contentDigest: revoke.contentDigest, reason: 'leaving' })
      .expect(403);
    const decided = await test.http
      .post(`/access/requests/${revoke.id}/approve`)
      .set(bearer(other.token))
      .send({ contentDigest: revoke.contentDigest })
      .expect(200);
    expect(decided.body).toMatchObject({ status: 'APPROVED', selfApproved: false });
    owner = await fresh(owner);
    await test.http
      .post(`/accounts/${other.accountId}/deactivate`)
      .set(bearer(owner.token))
      .send({ reason: 'left the team' })
      .expect(204);
    secondOwner = null;
  });
});
