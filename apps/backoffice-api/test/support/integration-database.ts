import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

/**
 * Integration DB harness. The admin URL (the disposable test database owner) creates one schema
 * per suite, applies every migration and the grant table there, then the app connects as the two
 * backoffice LOGIN users, so every query runs under the production grants (README §7).
 */
const SUPPORT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATABASE_DIR = path.resolve(SUPPORT_DIR, '../../../../packages/database');
const ROLE_GRANTS_DIR = path.join(DATABASE_DIR, 'prisma/role-grants');

export const ADMIN_DATABASE_URL_ENV = 'DORMDURI_BACKOFFICE_INTEGRATION_ADMIN_DATABASE_URL';
const DISPOSABLE_DATABASE_ENV = 'DORMDURI_BACKOFFICE_INTEGRATION_DISPOSABLE_DATABASE';
const DEFAULT_ADMIN_DATABASE_URL =
  'postgresql://dormduri_dev:dormduri_dev_password@localhost:5432/dormduri';

/** Local disposable-DB passwords, the same values the user API integration harness sets. */
export const BACKOFFICE_LOGIN_USERS = {
  runtime: { user: 'dormduri_backoffice', password: 'dormduri_backoffice_integration_password' },
  retention: {
    user: 'dormduri_backoffice_retention',
    password: 'dormduri_backoffice_retention_integration_password',
  },
} as const;

// bootstrap-roles.sql creates every LOGIN user; the harness sets all of them so a role whose
// password stayed unset never makes the user API harness and this one disagree.
const OTHER_LOGIN_USERS = {
  dormduri_api: 'dormduri_api_integration_password',
  dormduri_retention_worker: 'dormduri_retention_worker_integration_password',
  dormduri_api_disclosure: 'dormduri_api_disclosure_integration_password',
  dormduri_migrator: 'dormduri_migrator_integration_password',
};

export function adminDatabaseUrl(): string {
  return (
    process.env[ADMIN_DATABASE_URL_ENV] ?? process.env.DATABASE_URL ?? DEFAULT_ADMIN_DATABASE_URL
  );
}

function readRoleGrantFile(name: string): string {
  return readFileSync(path.join(ROLE_GRANTS_DIR, name), 'utf8');
}

function readCsv(name: string, width: number): string[][] {
  const [, ...lines] = readRoleGrantFile(name).replace(/\n$/u, '').split('\n');
  return lines.map((line) => {
    const fields = line.split(',');
    if (fields.length !== width) {
      throw new Error(`${name}: malformed line`);
    }
    return fields;
  });
}

function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(value)) {
    throw new Error(`unsafe identifier ${value}`);
  }
  return `"${value}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function assertDisposable(url: string): void {
  const host = new URL(url).hostname.toLowerCase();
  if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
    return;
  }
  if (process.env[DISPOSABLE_DATABASE_ENV] === 'yes') {
    return;
  }
  throw new Error(
    `backoffice integration refused: the admin database is not on loopback; set ${DISPOSABLE_DATABASE_ENV}=yes only for a disposable PostgreSQL`,
  );
}

export function withUser(url: string, login: { user: string; password: string }): string {
  const parsed = new URL(url);
  parsed.username = encodeURIComponent(login.user);
  parsed.password = encodeURIComponent(login.password);
  return parsed.toString();
}

function withSchema(url: string, schema: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('schema', schema);
  return parsed.toString();
}

/** Runs once per test run: the production bootstrap (group roles, LOGIN users) and passwords. */
export async function bootstrapIntegrationRoles(url = adminDatabaseUrl()): Promise<void> {
  assertDisposable(url);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("SELECT set_config('dormduri.bootstrap_schema', 'public', false)");
    await client.query("SELECT set_config('dormduri.bootstrap_pgaudit', 'off', false)");
    await client.query(readRoleGrantFile('bootstrap-roles.sql'));
    const passwords: Record<string, string> = {
      ...OTHER_LOGIN_USERS,
      [BACKOFFICE_LOGIN_USERS.runtime.user]: BACKOFFICE_LOGIN_USERS.runtime.password,
      [BACKOFFICE_LOGIN_USERS.retention.user]: BACKOFFICE_LOGIN_USERS.retention.password,
    };
    for (const [user, password] of Object.entries(passwords)) {
      await client.query(`ALTER ROLE ${quoteIdentifier(user)} PASSWORD ${quoteLiteral(password)}`);
    }
    await client.query(readRoleGrantFile('database-defaults.sql'));
  } finally {
    await client.end();
  }
}

async function applyGrants(client: Client, schema: string): Promise<void> {
  const matrix = readCsv('role-grant-matrix.csv', 4);
  const columns = readCsv('column-classes.csv', 3);
  await client.query(readRoleGrantFile('role-grant-inputs.sql'));
  await client.query(
    `INSERT INTO pg_temp.role_grant_matrix (table_name, role_name, privileges, columns)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])`,
    [
      matrix.map((row) => row[0]!),
      matrix.map((row) => row[1]!),
      matrix.map((row) => row[2]!.trim().split(/\s+/u).filter(Boolean).join(' ')),
      matrix.map((row) => row[3]!.trim()),
    ],
  );
  await client.query(
    `INSERT INTO pg_temp.role_grant_columns (table_name, column_name, column_class)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[])`,
    [columns.map((row) => row[0]!), columns.map((row) => row[1]!), columns.map((row) => row[2]!)],
  );
  await client.query("SELECT set_config('dormduri.grant_schema', $1, false)", [schema]);
  await client.query(readRoleGrantFile('apply-role-grants.sql'));
}

export interface IntegrationSandbox {
  readonly schema: string;
  /** Owner connection for fixtures and verification reads the app's roles must not do. */
  readonly admin: Client;
  readonly runtimeUrl: string;
  readonly retentionUrl: string;
  /** Runs one statement as a backoffice LOGIN user inside this schema. */
  asUser(
    login: { user: string; password: string },
    sql: string,
    values?: unknown[],
  ): Promise<unknown>;
  /** Table name qualified with the suite schema. */
  table(name: string): string;
  cleanup(): Promise<void>;
}

export async function createIntegrationSandbox(prefix: string): Promise<IntegrationSandbox> {
  const base = adminDatabaseUrl();
  assertDisposable(base);
  const schema = `${prefix}_${randomUUID().replaceAll('-', '')}`;
  const admin = new Client({ connectionString: base });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
  const schemaUrl = withSchema(base, schema);
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: DATABASE_DIR,
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: schemaUrl, DIRECT_URL: schemaUrl },
    stdio: 'pipe',
  });
  await applyGrants(admin, schema);
  await admin.query(`SET search_path TO ${quoteIdentifier(schema)}`);
  return {
    schema,
    admin,
    runtimeUrl: withUser(schemaUrl, BACKOFFICE_LOGIN_USERS.runtime),
    retentionUrl: withUser(schemaUrl, BACKOFFICE_LOGIN_USERS.retention),
    async asUser(login, sql, values = []) {
      const client = new Client({ connectionString: withUser(base, login) });
      await client.connect();
      try {
        await client.query(`SET search_path TO ${quoteIdentifier(schema)}`);
        return await client.query(sql, values);
      } finally {
        await client.end();
      }
    },
    table: (name) => `${quoteIdentifier(schema)}.${quoteIdentifier(name)}`,
    async cleanup() {
      try {
        await admin.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
      } finally {
        await admin.end();
      }
    },
  };
}
