import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import {
  createIntegrationDatabaseSandbox,
  type IntegrationDatabaseSandbox,
} from './support/integration-db.js';

describe('RRPD DB access control integration', () => {
  let sandbox: IntegrationDatabaseSandbox;
  let adminClient: Client;
  let appRuntimeRole: string;
  let retentionWorkerRole: string;
  let retentionDisclosureRole: string;

  beforeAll(async () => {
    sandbox = await createIntegrationDatabaseSandbox('rrpd_access');
    const suffix = toSafeIdentifier(sandbox.schemaName).slice(0, 24);
    appRuntimeRole = `rrpd_app_${suffix}`;
    retentionWorkerRole = `rrpd_worker_${suffix}`;
    retentionDisclosureRole = `rrpd_disclosure_${suffix}`;
    adminClient = new Client({ connectionString: sandbox.databaseUrl });
    await adminClient.connect();
    await dropRolesIfExist(adminClient, [
      appRuntimeRole,
      retentionWorkerRole,
      retentionDisclosureRole,
    ]);

    await adminClient.query("SELECT set_config('knu_roommate.rrpd_schema', $1, false)", [
      sandbox.schemaName,
    ]);
    await adminClient.query("SELECT set_config('knu_roommate.app_runtime_role', $1, false)", [
      appRuntimeRole,
    ]);
    await adminClient.query("SELECT set_config('knu_roommate.retention_worker_role', $1, false)", [
      retentionWorkerRole,
    ]);
    await adminClient.query(
      "SELECT set_config('knu_roommate.retention_disclosure_role', $1, false)",
      [retentionDisclosureRole],
    );

    const sql = readFileSync(
      path.resolve(process.cwd(), 'prisma/role-grants/rrpd-role-grants.sql'),
      'utf8',
    );
    await adminClient.query(sql);
  }, 60_000);

  afterAll(async () => {
    if (adminClient) {
      await adminClient.query('RESET ROLE');
      await dropRolesIfExist(adminClient, [
        appRuntimeRole,
        retentionWorkerRole,
        retentionDisclosureRole,
      ]);
      await adminClient.end();
    }
    if (sandbox) {
      await sandbox.cleanup();
    }
  });

  it('app_runtime은 일반 table은 읽을 수 있지만 RRPD payload table은 직접 읽지 못한다', async () => {
    await expect(
      queryAsRole(appRuntimeRole, `SELECT "id" FROM ${table('User')} LIMIT 1`),
    ).resolves.toBeDefined();

    await expect(
      queryAsRole(
        appRuntimeRole,
        `SELECT "encryptedPayload" FROM ${table('RetainedVaultObject')} LIMIT 1`,
      ),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      queryAsRole(
        appRuntimeRole,
        `SELECT "encryptedIdentifierPayload" FROM ${table('RetainedIdentity')} LIMIT 1`,
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('retention worker와 disclosure role은 retained payload 읽기 경계를 별도 credential로 가진다', async () => {
    await expect(
      queryAsRole(
        retentionWorkerRole,
        `SELECT "encryptedPayload" FROM ${table('RetainedVaultObject')} LIMIT 1`,
      ),
    ).resolves.toBeDefined();

    await expect(
      queryAsRole(
        retentionDisclosureRole,
        `SELECT "encryptedPayload" FROM ${table('RetainedVaultObject')} LIMIT 1`,
      ),
    ).resolves.toBeDefined();

    await expect(
      queryAsRole(retentionDisclosureRole, `UPDATE ${table('User')} SET "updatedAt" = "updatedAt"`),
    ).rejects.toThrow(/permission denied/i);
  });

  function table(name: string) {
    return `${quoteIdentifier(sandbox.schemaName)}.${quoteIdentifier(name)}`;
  }

  async function queryAsRole(role: string, sql: string) {
    await adminClient.query('RESET ROLE');
    await adminClient.query(`SET ROLE ${quoteIdentifier(role)}`);
    try {
      return await adminClient.query(sql);
    } finally {
      await adminClient.query('RESET ROLE');
    }
  }
});

async function dropRolesIfExist(client: Client, roles: string[]) {
  for (const role of roles) {
    if (!role) {
      continue;
    }
    await client.query(`DROP OWNED BY ${quoteIdentifier(role)}`).catch(() => undefined);
    await client.query(`DROP ROLE IF EXISTS ${quoteIdentifier(role)}`);
  }
}

function toSafeIdentifier(value: string) {
  const safe = value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (!/^[a-z_]/.test(safe)) {
    return `r_${safe}`;
  }
  return safe;
}

function quoteIdentifier(value: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`[rrpd-db-access-test] unsafe identifier: ${value}`);
  }
  return `"${value.replaceAll('"', '""')}"`;
}
