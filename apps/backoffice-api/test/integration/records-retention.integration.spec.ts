import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AdminRecordsRetention } from '../../src/audit/retention/admin-records-retention.js';
import { BackofficeRetentionPrisma } from '../../src/platform/database/backoffice-prisma.js';
import { BackofficeLogger } from '../../src/platform/observability/backoffice-logger.js';
import { BackofficeMetrics } from '../../src/platform/observability/backoffice-metrics.js';
import {
  createIntegrationSandbox,
  type IntegrationSandbox,
} from '../support/integration-database.js';

const OLD = "now() - interval '3 years 1 day'";
const RECENT = "now() - interval '3 years' + interval '1 day'";
const ENDED_LONG_AGO = "now() - interval '8 days'";
const ENDED_RECENTLY = "now() - interval '6 days'";

interface Fixture {
  accounts: Record<'active' | 'leaverNoAudit' | 'leaverRecentAudit' | 'leaverOldAudit', string>;
  requests: Record<
    'unreferenced' | 'recentAudit' | 'assignment' | 'pendingExpired' | 'young' | 'oldAudit',
    string
  >;
  assignments: Record<'revokedUnreferenced' | 'revokedRecentAudit' | 'active', string>;
}

/** Rows on both sides of every DR-R5·DR-R6 boundary, written with the database clock. */
async function seed(sandbox: IntegrationSandbox): Promise<Fixture> {
  const q = (sql: string, values: unknown[] = []) => sandbox.admin.query(sql, values);
  const t = (name: string) => sandbox.table(name);
  const id = () => randomUUID();
  const accounts = {
    active: id(),
    leaverNoAudit: id(),
    leaverRecentAudit: id(),
    leaverOldAudit: id(),
  };
  await q(
    `INSERT INTO ${t('AdminAccount')} ("id", "email", "displayName") VALUES ($1, $1 || '@a.test', 'active')`,
    [accounts.active],
  );
  for (const leaver of [
    accounts.leaverNoAudit,
    accounts.leaverRecentAudit,
    accounts.leaverOldAudit,
  ]) {
    await q(
      `INSERT INTO ${t('AdminAccount')} ("id", "email", "displayName", "status", "deactivatedAt")
       VALUES ($1, $1 || '@a.test', 'leaver', 'DEACTIVATED', now() - interval '4 years')`,
      [leaver],
    );
  }
  const requests = {
    unreferenced: id(),
    recentAudit: id(),
    assignment: id(),
    pendingExpired: id(),
    young: id(),
    oldAudit: id(),
  };
  const request = (requestId: string, status: string, closedAt: string | null, extra = '') =>
    q(
      `INSERT INTO ${t('AdminApprovalRequest')}
         ("id", "kind", "status", "contentDigest", "targetAccountId", "targetRole", "requestedByAccountId",
          "expiresAt", "closedAt"${extra ? ', "decidedByAccountId"' : ''})
       VALUES ($1, 'ROLE_GRANT', '${status}', repeat('a', 64), $2, 'AUDITOR', $2,
          ${closedAt ?? OLD}, ${closedAt ?? 'NULL'}${extra ? ', $3' : ''})`,
      extra ? [requestId, accounts.active, extra] : [requestId, accounts.active],
    );
  await request(requests.unreferenced, 'CANCELLED', OLD);
  await request(requests.recentAudit, 'CANCELLED', OLD);
  await request(requests.assignment, 'APPROVED', OLD, accounts.leaverRecentAudit);
  await request(requests.pendingExpired, 'PENDING', null);
  await request(requests.young, 'CANCELLED', "now() - interval '2 years'");
  await request(requests.oldAudit, 'CANCELLED', OLD);

  const assignments = { revokedUnreferenced: id(), revokedRecentAudit: id(), active: id() };
  await q(
    `INSERT INTO ${t('AdminRoleAssignment')} ("id", "accountId", "role", "grantedAt", "revokedAt")
     VALUES ($1, $2, 'AUDITOR', now() - interval '5 years', ${OLD}),
            ($3, $2, 'LEGAL_EDITOR', now() - interval '5 years', ${OLD})`,
    [assignments.revokedUnreferenced, accounts.active, assignments.revokedRecentAudit],
  );
  await q(
    `INSERT INTO ${t('AdminRoleAssignment')} ("id", "accountId", "role", "grantedByApprovalRequestId")
     VALUES ($1, $2, 'OWNER', $3)`,
    [assignments.active, accounts.active, requests.assignment],
  );

  const audit = (occurredAt: string, columns: string, values: string, params: unknown[]) =>
    q(
      `INSERT INTO ${t('AdminAuditEvent')} ("id", "occurredAt", "actorType", "result", ${columns})
       VALUES ('${id()}', ${occurredAt}, ${values})`,
      params,
    );
  await audit(OLD, '"actorAccountId", "action"', `'ADMIN', 'SUCCEEDED', $1, 'LOGIN'`, [
    accounts.leaverOldAudit,
  ]);
  await audit(RECENT, '"actorAccountId", "action"', `'ADMIN', 'SUCCEEDED', $1, 'LOGIN'`, [
    accounts.active,
  ]);
  await audit(
    RECENT,
    '"action", "targetType", "targetId"',
    `'SYSTEM', 'SUCCEEDED', 'ACCOUNT_DEACTIVATE', 'ADMIN_ACCOUNT', $1`,
    [accounts.leaverRecentAudit],
  );
  await audit(
    RECENT,
    '"action", "approvalRequestId"',
    `'SYSTEM', 'SUCCEEDED', 'ACCESS_REQUEST_CANCEL', $1`,
    [requests.recentAudit],
  );
  await audit(
    OLD,
    '"action", "approvalRequestId"',
    `'SYSTEM', 'SUCCEEDED', 'ACCESS_REQUEST_CANCEL', $1`,
    [requests.oldAudit],
  );
  await audit(
    RECENT,
    '"action", "targetType", "targetId"',
    `'SYSTEM', 'SUCCEEDED', 'ROLE_REVOKE', 'ADMIN_ROLE_ASSIGNMENT', $1`,
    [assignments.revokedRecentAudit],
  );

  const session = (revokedAt: string | null, lastActivityAt: string, absoluteExpiresAt: string) =>
    q(
      `INSERT INTO ${t('AdminSession')} ("id", "accountId", "tokenHash", "scope", "lastActivityAt", "absoluteExpiresAt", "revokedAt", "revocationReason")
       VALUES ($1, $2, $1, 'FULL', ${lastActivityAt}, ${absoluteExpiresAt}, ${revokedAt ?? 'NULL'}, ${revokedAt ? "'LOGOUT'" : 'NULL'})`,
      [id(), accounts.active],
    );
  await session(ENDED_LONG_AGO, ENDED_LONG_AGO, "now() - interval '7 days 16 hours'");
  await session(
    null,
    "now() - interval '8 days 1 hour'",
    "now() - interval '8 days' + interval '7 hours'",
  );
  await session(ENDED_RECENTLY, ENDED_RECENTLY, "now() - interval '5 days'");
  await session(null, 'now()', "now() + interval '8 hours'");

  const challenge = (expiresAt: string, usedAt: string | null) =>
    q(
      `INSERT INTO ${t('AdminWebAuthnChallenge')} ("id", "purpose", "challenge", "accountId", "expiresAt", "usedAt")
       VALUES ($1, 'AUTHENTICATION', $1, $2, ${expiresAt}, ${usedAt ?? 'NULL'})`,
      [id(), accounts.active],
    );
  await challenge(ENDED_LONG_AGO, ENDED_LONG_AGO);
  await challenge(ENDED_RECENTLY, null);
  await challenge("now() - interval '8 days'", null);

  const invitation = (expiresAt: string, usedAt: string | null, revokedAt: string | null) =>
    q(
      `INSERT INTO ${t('AdminInvitation')} ("id", "kind", "email", "displayName", "codeHash", "expiresAt", "usedAt", "revokedAt")
       VALUES ($1, 'OPERATOR', $1 || '@i.test', 'invitee', $1, ${expiresAt}, ${usedAt ?? 'NULL'}, ${revokedAt ?? 'NULL'})`,
      [id()],
    );
  await invitation(ENDED_LONG_AGO, ENDED_LONG_AGO, null);
  await invitation(ENDED_LONG_AGO, null, ENDED_LONG_AGO);
  await invitation("now() + interval '10 minutes'", null, null);
  await invitation(ENDED_RECENTLY, ENDED_RECENTLY, null);

  return { accounts, requests, assignments };
}

async function snapshot(sandbox: IntegrationSandbox) {
  const ids = async (table: string, order = '"id"') =>
    (
      await sandbox.admin.query<{ id: string }>(
        `SELECT "id" FROM ${sandbox.table(table)} ORDER BY ${order}`,
      )
    ).rows.map((row) => row.id);
  const anonymized = (
    await sandbox.admin.query<{ id: string }>(
      `SELECT "id" FROM ${sandbox.table('AdminAccount')} WHERE "anonymizedAt" IS NOT NULL
         AND "email" = 'anonymized+' || "id" || '@backoffice.invalid' ORDER BY "id"`,
    )
  ).rows.map((row) => row.id);
  return {
    audit: (await ids('AdminAuditEvent')).length,
    requests: await ids('AdminApprovalRequest'),
    assignments: await ids('AdminRoleAssignment'),
    anonymized,
    sessions: (await ids('AdminSession')).length,
    challenges: (await ids('AdminWebAuthnChallenge')).length,
    invitations: (await ids('AdminInvitation')).length,
  };
}

function retentionJob(sandbox: IntegrationSandbox) {
  const prisma = new BackofficeRetentionPrisma({
    url: sandbox.retentionUrl,
    poolMax: 1,
    applicationName: 'retention-integration',
  });
  const job = new AdminRecordsRetention(
    prisma,
    new BackofficeMetrics('test'),
    new BackofficeLogger('error'),
  );
  return { job, close: () => prisma.close() };
}

const sorted = (values: string[]) => [...values].sort();

describe('backoffice records cleanup as dormduri_backoffice_retention (DR-R5, DR-R6)', () => {
  let sandbox: IntegrationSandbox;
  let parallelSandbox: IntegrationSandbox;

  beforeAll(async () => {
    sandbox = await createIntegrationSandbox('bo_retention');
    parallelSandbox = await createIntegrationSandbox('bo_retention_parallel');
  });

  afterAll(async () => {
    await sandbox?.cleanup();
    await parallelSandbox?.cleanup();
  });

  it('removes exactly the rows past each boundary, in order, and a second run changes nothing', async () => {
    const fixture = await seed(sandbox);
    const { job, close } = retentionJob(sandbox);
    try {
      const first = await job.runOnce();
      expect(first).toEqual({
        ok: true,
        processed: {
          audit_events: 2,
          role_assignments: 1,
          approval_requests: 3,
          account_anonymization: 2,
          sessions: 2,
          webauthn_challenges: 2,
          invitations: 2,
        },
      });
      const state = await snapshot(sandbox);
      expect(state).toEqual({
        audit: 4,
        requests: sorted([
          fixture.requests.recentAudit,
          fixture.requests.assignment,
          fixture.requests.young,
        ]),
        assignments: sorted([fixture.assignments.revokedRecentAudit, fixture.assignments.active]),
        // The leaver whose only audit row was old is anonymized in the same run, after step 1.
        anonymized: sorted([fixture.accounts.leaverNoAudit, fixture.accounts.leaverOldAudit]),
        sessions: 2,
        challenges: 1,
        invitations: 2,
      });

      const second = await job.runOnce();
      expect(second).toEqual({
        ok: true,
        processed: {
          audit_events: 0,
          role_assignments: 0,
          approval_requests: 0,
          account_anonymization: 0,
          sessions: 0,
          webauthn_challenges: 0,
          invitations: 0,
        },
      });
      expect(await snapshot(sandbox)).toEqual(state);
    } finally {
      await close();
    }
  });

  it('ends in the same state when two containers run the job at the same time', async () => {
    const fixture = await seed(parallelSandbox);
    const left = retentionJob(parallelSandbox);
    const right = retentionJob(parallelSandbox);
    try {
      const results = await Promise.all([left.job.runOnce(), right.job.runOnce()]);
      for (const result of results) {
        expect(result.ok).toBe(true);
      }
      const total = (step: string) =>
        results.reduce(
          (sum, result) => sum + ((result.processed as Record<string, number>)[step] ?? 0),
          0,
        );
      // Every row changes once even when both runs pick it.
      expect(total('audit_events')).toBe(2);
      expect(total('approval_requests')).toBe(3);
      expect(total('account_anonymization')).toBe(2);
      expect(await snapshot(parallelSandbox)).toMatchObject({
        audit: 4,
        requests: sorted([
          fixture.requests.recentAudit,
          fixture.requests.assignment,
          fixture.requests.young,
        ]),
        anonymized: sorted([fixture.accounts.leaverNoAudit, fixture.accounts.leaverOldAudit]),
        sessions: 2,
        challenges: 1,
        invitations: 2,
      });
    } finally {
      await left.close();
      await right.close();
    }
  });
});
