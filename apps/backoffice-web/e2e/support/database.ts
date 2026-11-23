import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

/**
 * Disposable database for the e2e run. Like the backoffice API integration harness it applies the
 * production role bootstrap, every migration and the grant table to a fresh schema, so the API in
 * the e2e connects as `dormduri_backoffice` and `dormduri_backoffice_retention` under the real grants.
 */
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const DATABASE_DIR = path.join(REPO_ROOT, 'packages/database');
const ROLE_GRANTS_DIR = path.join(DATABASE_DIR, 'prisma/role-grants');
const DEFAULT_ADMIN_URL = 'postgresql://dormduri_dev:dormduri_dev_password@localhost:5432/dormduri';

export const ADMIN_URL_ENV = 'DORMDURI_BACKOFFICE_E2E_ADMIN_DATABASE_URL';
const DISPOSABLE_ENV = 'DORMDURI_BACKOFFICE_E2E_DISPOSABLE_DATABASE';

// Local disposable-DB passwords, the same values the API integration harnesses set.
const LOGIN_PASSWORDS: Record<string, string> = {
  dormduri_api: 'dormduri_api_integration_password',
  dormduri_retention_worker: 'dormduri_retention_worker_integration_password',
  dormduri_api_disclosure: 'dormduri_api_disclosure_integration_password',
  dormduri_migrator: 'dormduri_migrator_integration_password',
  dormduri_backoffice: 'dormduri_backoffice_integration_password',
  dormduri_backoffice_retention: 'dormduri_backoffice_retention_integration_password',
};

export function adminDatabaseUrl(): string {
  return process.env[ADMIN_URL_ENV] ?? process.env.DATABASE_URL ?? DEFAULT_ADMIN_URL;
}

function assertDisposable(url: string): void {
  const host = new URL(url).hostname.toLowerCase();
  if (
    ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host) ||
    process.env[DISPOSABLE_ENV] === 'yes'
  ) {
    return;
  }
  throw new Error(
    `backoffice e2e refused: the admin database is not on loopback; set ${DISPOSABLE_ENV}=yes only for a disposable PostgreSQL`,
  );
}

function roleGrantFile(name: string): string {
  return readFileSync(path.join(ROLE_GRANTS_DIR, name), 'utf8');
}

function csv(name: string, width: number): string[][] {
  const [, ...lines] = roleGrantFile(name).replace(/\n$/u, '').split('\n');
  return lines.map((line) => {
    const fields = line.split(',');
    if (fields.length !== width) throw new Error(`${name}: malformed line`);
    return fields;
  });
}

function identifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(value)) throw new Error(`unsafe identifier ${value}`);
  return `"${value}"`;
}

function withUrl(
  url: string,
  change: { user?: string; password?: string; schema?: string },
): string {
  const parsed = new URL(url);
  if (change.user) parsed.username = encodeURIComponent(change.user);
  if (change.password) parsed.password = encodeURIComponent(change.password);
  if (change.schema) parsed.searchParams.set('schema', change.schema);
  return parsed.toString();
}

export interface E2eDatabase {
  readonly schema: string;
  readonly runtimeUrl: string;
  readonly retentionUrl: string;
  drop(): Promise<void>;
}

export async function createE2eDatabase(): Promise<E2eDatabase> {
  const base = adminDatabaseUrl();
  assertDisposable(base);
  const schema = `bo_web_e2e_${randomUUID().replaceAll('-', '')}`;
  const admin = new Client({ connectionString: base });
  await admin.connect();
  try {
    await admin.query("SELECT set_config('dormduri.bootstrap_schema', 'public', false)");
    await admin.query("SELECT set_config('dormduri.bootstrap_pgaudit', 'off', false)");
    await admin.query(roleGrantFile('bootstrap-roles.sql'));
    for (const [user, password] of Object.entries(LOGIN_PASSWORDS)) {
      await admin.query(
        `ALTER ROLE ${identifier(user)} PASSWORD '${password.replaceAll("'", "''")}'`,
      );
    }
    await admin.query(roleGrantFile('database-defaults.sql'));
    await admin.query(`CREATE SCHEMA ${identifier(schema)}`);
    const schemaUrl = withUrl(base, { schema });
    execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      cwd: DATABASE_DIR,
      env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: schemaUrl, DIRECT_URL: schemaUrl },
      stdio: 'pipe',
    });
    const matrix = csv('role-grant-matrix.csv', 4);
    const columns = csv('column-classes.csv', 3);
    await admin.query(roleGrantFile('role-grant-inputs.sql'));
    await admin.query(
      `INSERT INTO pg_temp.role_grant_matrix (table_name, role_name, privileges, columns)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])`,
      [
        matrix.map((row) => row[0]!),
        matrix.map((row) => row[1]!),
        matrix.map((row) => row[2]!.trim().split(/\s+/u).filter(Boolean).join(' ')),
        matrix.map((row) => row[3]!.trim()),
      ],
    );
    await admin.query(
      `INSERT INTO pg_temp.role_grant_columns (table_name, column_name, column_class)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[])`,
      [columns.map((row) => row[0]!), columns.map((row) => row[1]!), columns.map((row) => row[2]!)],
    );
    await admin.query("SELECT set_config('dormduri.grant_schema', $1, false)", [schema]);
    await admin.query(roleGrantFile('apply-role-grants.sql'));
  } finally {
    await admin.end();
  }
  const schemaUrl = withUrl(base, { schema });
  return {
    schema,
    runtimeUrl: withUrl(schemaUrl, {
      user: 'dormduri_backoffice',
      password: LOGIN_PASSWORDS.dormduri_backoffice,
    }),
    retentionUrl: withUrl(schemaUrl, {
      user: 'dormduri_backoffice_retention',
      password: LOGIN_PASSWORDS.dormduri_backoffice_retention,
    }),
    async drop() {
      const client = new Client({ connectionString: base });
      await client.connect();
      try {
        await client.query(`DROP SCHEMA IF EXISTS ${identifier(schema)} CASCADE`);
      } finally {
        await client.end();
      }
    },
  };
}
