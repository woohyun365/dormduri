import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { PrismaClient } from '../../../src/generated/prisma/client.js';

const DEFAULT_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/knu_roommate?schema=public';

const SUPPORT_DIR = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.resolve(SUPPORT_DIR, '../../..');

export interface IntegrationDatabaseSandbox {
  schemaName: string;
  databaseUrl: string;
  cleanup: () => Promise<void>;
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
  process.env.DATABASE_URL = databaseUrl;
  process.env.DIRECT_URL = databaseUrl;
  process.env.PRISMA_QUERY_LOG_EVENTS = '1';
}

function runPrismaMigrateDeploy(databaseUrl: string) {
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: API_DIR,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: 'pipe',
  });
}

export function runPrismaMigrateStatus(databaseUrl: string) {
  return execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'status'], {
    cwd: API_DIR,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: 'pipe',
    encoding: 'utf8',
  });
}

export async function createIntegrationDatabaseSandbox(
  schemaPrefix: string,
): Promise<IntegrationDatabaseSandbox> {
  const baseDatabaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const schemaName = `${schemaPrefix}_${randomUUID().replaceAll('-', '')}`;
  const databaseUrl = toDatabaseUrlWithSchema(baseDatabaseUrl, schemaName);
  const adminClient = new Client({ connectionString: resolveAdminDatabaseUrl(baseDatabaseUrl) });

  await adminClient.connect();
  try {
    await adminClient.query(`CREATE SCHEMA "${schemaName}"`);
  } finally {
    await adminClient.end();
  }

  setRuntimeDatabaseUrl(databaseUrl);
  runPrismaMigrateDeploy(databaseUrl);

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
  const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const targetSchema = new URL(databaseUrl).searchParams.get('schema');
  if (!targetSchema) {
    throw new Error('[integration-db] DATABASE_URL schema is required for truncation');
  }

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
