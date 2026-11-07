import { Client } from 'pg';
import {
  applyRoleGrants,
  readRoleGrantFile,
  ROLE_GRANT_FILES,
} from '../../support/database/role-grant-inputs.js';

/**
 * Integration DB role mode.
 *
 * - `separated`(integration runner default, CI): the harness keeps a privileged admin
 *   connection (the test database owner) for suite schema creation, `migrate deploy`,
 *   grant SQL, TRUNCATE, fixture writes and verification reads. The app under test
 *   connects with one LOGIN user per Prisma role, so grants run on every request.
 * - `shared`: every Prisma role uses the admin URL (no grant check). The e2e runner
 *   and environments whose base user cannot create roles use this mode.
 *
 * The integration global setup resolves the mode once and exports it with the admin
 * URL, because each suite later overwrites `DATABASE_URL` with a LOGIN user URL.
 */
export type IntegrationDatabaseRoleMode = 'separated' | 'shared';

export const INTEGRATION_DATABASE_ROLE_MODE_ENV = 'DORMDURI_API_INTEGRATION_DATABASE_ROLES';
export const INTEGRATION_ADMIN_DATABASE_URL_ENV = 'DORMDURI_API_INTEGRATION_ADMIN_DATABASE_URL';

/** LOGIN users that the app under test uses. Passwords are local disposable-DB values. */
export const INTEGRATION_LOGIN_USERS = {
  runtime: { user: 'dormduri_api', password: 'dormduri_api_integration_password' },
  retentionWorker: {
    user: 'dormduri_retention_worker',
    password: 'dormduri_retention_worker_integration_password',
  },
  retentionDisclosure: {
    user: 'dormduri_api_disclosure',
    password: 'dormduri_api_disclosure_integration_password',
  },
  migrator: { user: 'dormduri_migrator', password: 'dormduri_migrator_integration_password' },
} as const;

export function parseIntegrationDatabaseRoleMode(
  value: string | undefined,
  fallback: IntegrationDatabaseRoleMode,
): IntegrationDatabaseRoleMode {
  if (value === undefined || value === '') {
    return fallback;
  }
  if (value === 'separated' || value === 'shared') {
    return value;
  }
  throw new Error(
    `[integration-db] ${INTEGRATION_DATABASE_ROLE_MODE_ENV} must be separated or shared`,
  );
}

/** Mode inside a test worker: only the integration global setup turns separated on. */
export function resolveIntegrationDatabaseRoleMode(): IntegrationDatabaseRoleMode {
  return parseIntegrationDatabaseRoleMode(
    process.env[INTEGRATION_DATABASE_ROLE_MODE_ENV],
    'shared',
  );
}

export function withDatabaseUser(databaseUrl: string, user: string, password: string): string {
  const url = new URL(databaseUrl);
  url.username = encodeURIComponent(user);
  url.password = encodeURIComponent(password);
  return url.toString();
}

/**
 * Runs the production bootstrap (group roles, LOGIN users, membership) and the
 * database-wide default privileges once per test database. Both are cluster or
 * database wide, so parallel workers never run them; the integration global setup
 * does. pgaudit settings are off because the disposable PostgreSQL has no pgaudit.
 */
export async function bootstrapIntegrationDatabaseRoles(adminDatabaseUrl: string): Promise<void> {
  const client = new Client({ connectionString: adminDatabaseUrl });
  await client.connect();
  try {
    await client.query("SELECT set_config('dormduri.bootstrap_schema', 'public', false)");
    await client.query("SELECT set_config('dormduri.bootstrap_pgaudit', 'off', false)");
    await client.query(readRoleGrantFile(ROLE_GRANT_FILES.bootstrap));
    for (const { user, password } of Object.values(INTEGRATION_LOGIN_USERS)) {
      await client.query(`ALTER ROLE ${quoteIdentifier(user)} PASSWORD ${quoteLiteral(password)}`);
    }
    await client.query(readRoleGrantFile(ROLE_GRANT_FILES.databaseDefaults));
  } finally {
    await client.end();
  }
}

/** Applies the grant table to one suite schema with the admin connection. */
export async function applyIntegrationSchemaGrants(
  adminDatabaseUrl: string,
  schemaName: string,
): Promise<void> {
  const client = new Client({ connectionString: adminDatabaseUrl });
  await client.connect();
  try {
    await applyRoleGrants(client, schemaName);
  } finally {
    await client.end();
  }
}

export function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(value)) {
    throw new Error(`[integration-db] unsafe identifier: ${value}`);
  }
  return `"${value}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
