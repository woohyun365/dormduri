import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BACKOFFICE_LOGIN_USERS,
  createIntegrationSandbox,
  type IntegrationSandbox,
} from '../support/integration-database.js';

/**
 * The two backoffice LOGIN users reach only the admin tables (infra/db/README.md grant 표). The RRPD tables stay out of
 * reach of the backoffice API until an RRPD plan adds its own disclosure user (#236, OA-R11).
 */
describe('backoffice database boundary', () => {
  let sandbox: IntegrationSandbox;

  beforeAll(async () => {
    sandbox = await createIntegrationSandbox('bo_boundary');
  });

  afterAll(async () => {
    await sandbox?.cleanup();
  });

  const RRPD_AND_USER_READS = [
    'SELECT 1 FROM "RetainedVaultObject" LIMIT 1',
    'SELECT 1 FROM "RetainedIdentity" LIMIT 1',
    'SELECT 1 FROM "RetainedVaultObjectHold" LIMIT 1',
    'SELECT 1 FROM "RetentionAccessLog" LIMIT 1',
    'SELECT 1 FROM "RetentionCase" LIMIT 1',
    'SELECT 1 FROM "User" LIMIT 1',
    'SELECT 1 FROM "AuthSession" LIMIT 1',
    'SELECT 1 FROM "SupportTicket" LIMIT 1',
  ];

  it('refuses dormduri_backoffice every RRPD and user table read (#236)', async () => {
    for (const sql of RRPD_AND_USER_READS) {
      await expect(sandbox.asUser(BACKOFFICE_LOGIN_USERS.runtime, sql), sql).rejects.toThrow(
        /permission denied/u,
      );
    }
  });

  it('refuses dormduri_backoffice_retention the same reads', async () => {
    for (const sql of RRPD_AND_USER_READS) {
      await expect(sandbox.asUser(BACKOFFICE_LOGIN_USERS.retention, sql), sql).rejects.toThrow(
        /permission denied/u,
      );
    }
  });

  it('lets dormduri_backoffice append audit rows only with the database clock', async () => {
    const insert = (columns: string, values: string) =>
      sandbox.asUser(
        BACKOFFICE_LOGIN_USERS.runtime,
        `INSERT INTO "AdminAuditEvent" (${columns}) VALUES (${values})`,
      );
    await expect(
      insert(
        '"id", "actorType", "action", "result"',
        `'${randomUUID()}', 'SYSTEM', 'AUDIT_REVIEW', 'SUCCEEDED'`,
      ),
    ).resolves.toBeDefined();
    await expect(
      insert(
        '"id", "occurredAt", "actorType", "action", "result"',
        `'${randomUUID()}', now() - interval '4 years', 'SYSTEM', 'AUDIT_REVIEW', 'SUCCEEDED'`,
      ),
    ).rejects.toThrow(/permission denied/u);
    for (const sql of [
      'UPDATE "AdminAuditEvent" SET "reason" = "reason"',
      'DELETE FROM "AdminAuditEvent"',
    ]) {
      await expect(sandbox.asUser(BACKOFFICE_LOGIN_USERS.runtime, sql), sql).rejects.toThrow(
        /permission denied/u,
      );
    }
  });

  it('gives dormduri_backoffice_retention no audit append and no audit content', async () => {
    for (const sql of [
      `INSERT INTO "AdminAuditEvent" ("id", "actorType", "action", "result") VALUES ('${randomUUID()}', 'SYSTEM', 'LOGIN', 'SUCCEEDED')`,
      'SELECT "reason" FROM "AdminAuditEvent" LIMIT 1',
      'SELECT "metadata" FROM "AdminAuditEvent" LIMIT 1',
      'SELECT "email" FROM "AdminAccount" LIMIT 1',
      'SELECT "tokenHash" FROM "AdminSession" LIMIT 1',
    ]) {
      await expect(sandbox.asUser(BACKOFFICE_LOGIN_USERS.retention, sql), sql).rejects.toThrow(
        /permission denied/u,
      );
    }
  });
});
