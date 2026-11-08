import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@repo/database/client';
import {
  applyIntegrationSchemaGrants,
  INTEGRATION_ADMIN_DATABASE_URL_ENV,
  INTEGRATION_LOGIN_USERS,
  resolveIntegrationDatabaseRoleMode,
  withDatabaseUser,
} from './integration-db-roles.js';
import { recordIntegrationMigrationInvocation } from './integration-migration-evidence.js';

const DEFAULT_DATABASE_URL =
  'postgresql://dormduri_dev:dormduri_dev_password@localhost:5432/dormduri?schema=public';

/**
 * Integration specs run against a disposable PostgreSQL schema created from the
 * admin DATABASE_URL and apply Prisma migrations into that schema. In the
 * separated role mode (integration-db-roles.ts) the app connects with one LOGIN
 * user per Prisma role and only this helper uses the admin URL. If local
 * execution fails with a PostgreSQL credential error such as P1000, treat it as
 * an environment blocker and recreate/fix the local Postgres volume or
 * DATABASE_URL credentials before rerunning; the helper intentionally does not
 * mask that failure.
 */
const SUPPORT_DIR = path.dirname(fileURLToPath(import.meta.url));
// Prisma CLI runs from the shared database package, where its config, schema and migrations live.
const DATABASE_DIR = path.resolve(SUPPORT_DIR, '../../../../../packages/database');

export interface IntegrationDatabaseSandbox {
  schemaName: string;
  /** Privileged admin URL for this suite schema (fixtures, verification reads, CLI). */
  databaseUrl: string;
  cleanup: () => Promise<void>;
}

/**
 * Admin URL that survives suites rewriting DATABASE_URL. The integration global setup
 * sets it; other runners (e2e) capture the first DATABASE_URL here.
 */
function resolveBaseAdminDatabaseUrl() {
  const current = process.env[INTEGRATION_ADMIN_DATABASE_URL_ENV];
  if (current) {
    return current;
  }
  const captured = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  process.env[INTEGRATION_ADMIN_DATABASE_URL_ENV] = captured;
  return captured;
}

function toDatabaseUrlWithSchema(databaseUrl: string, schemaName: string) {
  const url = new URL(databaseUrl);
  url.searchParams.set('schema', schemaName);
  url.searchParams.set('options', `-c search_path=${schemaName}`);
  return url.toString();
}

function resolveAdminDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  url.searchParams.set('schema', 'public');
  return url.toString();
}

function setRuntimeDatabaseUrl(databaseUrl: string) {
  const separated = resolveIntegrationDatabaseRoleMode() === 'separated';
  const roleUrl = (login: { user: string; password: string }) =>
    separated ? withDatabaseUser(databaseUrl, login.user, login.password) : databaseUrl;

  process.env.DATABASE_URL = roleUrl(INTEGRATION_LOGIN_USERS.runtime);
  process.env.RETENTION_WORKER_DATABASE_URL = roleUrl(INTEGRATION_LOGIN_USERS.retentionWorker);
  process.env.RETENTION_DISCLOSURE_DATABASE_URL = roleUrl(
    INTEGRATION_LOGIN_USERS.retentionDisclosure,
  );
  process.env.DIRECT_URL = databaseUrl;
  process.env.MIGRATION_DATABASE_URL = databaseUrl;
  process.env.PRISMA_QUERY_LOG_EVENTS = '1';
}

export function runPrismaMigrateDeploy(databaseUrl: string) {
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: DATABASE_DIR,
    // prisma.config.ts reads DIRECT_URL before DATABASE_URL.
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
    },
    stdio: 'pipe',
  });
}

export function runPrismaMigrateStatus(databaseUrl: string) {
  return execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'status'], {
    cwd: DATABASE_DIR,
    // prisma.config.ts reads DIRECT_URL before DATABASE_URL.
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
    },
    stdio: 'pipe',
    encoding: 'utf8',
  });
}

export async function createIntegrationDatabaseSandbox(
  schemaPrefix: string,
): Promise<IntegrationDatabaseSandbox> {
  const baseDatabaseUrl = resolveBaseAdminDatabaseUrl();
  const schemaName = `${schemaPrefix}_${randomUUID().replaceAll('-', '')}`;
  const databaseUrl = toDatabaseUrlWithSchema(baseDatabaseUrl, schemaName);
  const adminClient = new Client({ connectionString: resolveAdminDatabaseUrl(baseDatabaseUrl) });

  await adminClient.connect();
  try {
    await adminClient.query(`CREATE SCHEMA "${schemaName}"`);
  } finally {
    await adminClient.end();
  }

  runPrismaMigrateDeploy(databaseUrl);
  recordIntegrationMigrationInvocation(schemaName);
  if (resolveIntegrationDatabaseRoleMode() === 'separated') {
    await applyIntegrationSchemaGrants(resolveAdminDatabaseUrl(baseDatabaseUrl), schemaName);
  }
  setRuntimeDatabaseUrl(databaseUrl);

  return {
    schemaName,
    databaseUrl,
    cleanup: async () => {
      const cleanupClient = new Client({
        connectionString: resolveAdminDatabaseUrl(baseDatabaseUrl),
      });
      await cleanupClient.connect();
      try {
        await cleanupClient.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      } finally {
        await cleanupClient.end();
      }
    },
  };
}

export async function truncateIntegrationSchema(_prisma: PrismaClient) {
  const databaseUrl = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('[integration-db] suite database URL is required for truncation');
  }
  const targetSchema = new URL(databaseUrl).searchParams.get('schema');
  if (!targetSchema) {
    throw new Error('[integration-db] DATABASE_URL schema is required for truncation');
  }

  // TRUNCATE is not granted to any app role; the suite admin URL does it.
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows: tables } = await client.query<{ tablename: string }>(
      `
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = $1
          AND tablename <> '_prisma_migrations'
        ORDER BY tablename ASC
      `,
      [targetSchema],
    );

    if (tables.length === 0) {
      return;
    }

    const tableList = tables.map((row) => `"${targetSchema}"."${row.tablename}"`).join(', ');
    await client.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
  } finally {
    await client.end();
  }
}

/**
 * Privileged Prisma client for fixture writes and verification reads that the app's
 * own role must not do (RRPD tables, audit rows, migration history). Production code
 * paths keep using the app's role clients so grants stay under test.
 */
export function createIntegrationAdminPrisma(sandbox: IntegrationDatabaseSandbox): PrismaClient {
  const schema = new URL(sandbox.databaseUrl).searchParams.get('schema') ?? undefined;
  const connectionUrl = new URL(sandbox.databaseUrl);
  connectionUrl.searchParams.delete('schema');
  connectionUrl.searchParams.delete('options');
  return new PrismaClient({
    adapter: new PrismaPg(
      {
        connectionString: connectionUrl.toString(),
        max: 2,
        options: schema ? `-c search_path=${schema} -c timezone=UTC` : '-c timezone=UTC',
      },
      { schema },
    ),
  });
}
