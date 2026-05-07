import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../src/generated/prisma/client.js';
import { apiEnv } from '../../../src/config/env.js';

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
  return url.toString();
}

function resolveAdminDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  url.searchParams.set('schema', 'public');
  return url.toString();
}

function setRuntimeDatabaseUrl(databaseUrl: string) {
  process.env.DATABASE_URL = databaseUrl;
  (apiEnv as { databaseUrl: string }).databaseUrl = databaseUrl;
}

function runPrismaDbPush(databaseUrl: string) {
  execFileSync('pnpm', ['exec', 'prisma', 'db', 'push'], {
    cwd: API_DIR,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: 'pipe',
  });
}

export async function createIntegrationDatabaseSandbox(
  schemaPrefix: string,
): Promise<IntegrationDatabaseSandbox> {
  const baseDatabaseUrl = process.env.DATABASE_URL ?? apiEnv.databaseUrl ?? DEFAULT_DATABASE_URL;
  const schemaName = `${schemaPrefix}_${randomUUID().replaceAll('-', '')}`;
  const databaseUrl = toDatabaseUrlWithSchema(baseDatabaseUrl, schemaName);
  const adminClient = new PrismaClient({
    adapter: new PrismaPg({ connectionString: resolveAdminDatabaseUrl(baseDatabaseUrl) }),
  });

  await adminClient.$connect();
  try {
    await adminClient.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
  } finally {
    await adminClient.$disconnect();
  }

  setRuntimeDatabaseUrl(databaseUrl);
  runPrismaDbPush(databaseUrl);

  return {
    schemaName,
    databaseUrl,
    cleanup: async () => {
      const cleanupClient = new PrismaClient({
        adapter: new PrismaPg({ connectionString: resolveAdminDatabaseUrl(baseDatabaseUrl) }),
      });
      await cleanupClient.$connect();
      try {
        await cleanupClient.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      } finally {
        await cleanupClient.$disconnect();
      }
    },
  };
}

export async function truncateIntegrationSchema(prisma: PrismaClient) {
  const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
    `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = current_schema()
        AND tablename <> '_prisma_migrations'
      ORDER BY tablename ASC
    `,
  );

  if (tables.length === 0) {
    return;
  }

  const tableList = tables.map((row) => `"${row.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
}
