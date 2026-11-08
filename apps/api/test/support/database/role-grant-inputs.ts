import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Client } from 'pg';

/**
 * Reads the grant table and column classes from packages/database and loads them
 * into a pg session the same way infra/db/*.sh does with psql \copy, so tests run
 * the production apply/smoke SQL unchanged.
 */
const SUPPORT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROLE_GRANTS_DIR = path.resolve(
  SUPPORT_DIR,
  '../../../../../packages/database/prisma/role-grants',
);

export const ROLE_GRANT_FILES = {
  bootstrap: 'bootstrap-roles.sql',
  inputs: 'role-grant-inputs.sql',
  databaseDefaults: 'database-defaults.sql',
  apply: 'apply-role-grants.sql',
  smoke: 'smoke-role-grants.sql',
  matrix: 'role-grant-matrix.csv',
  columnClasses: 'column-classes.csv',
} as const;

export const MANAGED_DATABASE_ROLES = [
  'app_runtime',
  'retention_worker',
  'retention_disclosure',
  'app_readonly',
  'backoffice_runtime',
] as const;

export const GRANT_PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;

export const COLUMN_CLASSES = [
  'secret',
  'identifier',
  'pseudonymous',
  'quasi',
  'content',
  'reference',
  'operational',
] as const;

export interface RoleGrantMatrixRow {
  table: string;
  role: string;
  privileges: string[];
  /** '' = table-level, column names, or `-<class>` exclusions (space-separated). */
  columns: string;
}

export interface ColumnClassRow {
  table: string;
  column: string;
  columnClass: string;
}

export function readRoleGrantFile(fileName: string): string {
  return readFileSync(path.join(ROLE_GRANTS_DIR, fileName), 'utf8');
}

function readCsv(fileName: string, header: string, width: number): string[][] {
  const [firstLine, ...lines] = readRoleGrantFile(fileName).replace(/\n$/u, '').split('\n');
  if (firstLine !== header) {
    throw new Error(`[role-grant-inputs] ${fileName} header must be ${header}`);
  }
  return lines.map((line, index) => {
    const fields = line.split(',');
    if (fields.length !== width || /["\r]/u.test(line)) {
      throw new Error(
        `[role-grant-inputs] ${fileName} line ${index + 2} must have ${width} plain fields`,
      );
    }
    return fields;
  });
}

export function readRoleGrantMatrix(): RoleGrantMatrixRow[] {
  return readCsv(ROLE_GRANT_FILES.matrix, 'table,role,privileges,columns', 4).map(
    ([table, role, privileges, columns]) => ({
      table: table!,
      role: role!,
      privileges: privileges!.trim() === '' ? [] : privileges!.trim().split(/\s+/u),
      columns: columns!.trim(),
    }),
  );
}

export function readColumnClasses(): ColumnClassRow[] {
  return readCsv(ROLE_GRANT_FILES.columnClasses, 'table,column,class', 3).map(
    ([table, column, columnClass]) => ({
      table: table!,
      column: column!,
      columnClass: columnClass!,
    }),
  );
}

/** Creates the session-local input tables and helper functions, then fills them. */
export async function loadRoleGrantInputs(client: Client): Promise<void> {
  const matrix = readRoleGrantMatrix();
  const columns = readColumnClasses();
  await client.query(readRoleGrantFile(ROLE_GRANT_FILES.inputs));
  await client.query(
    `INSERT INTO pg_temp.role_grant_matrix (table_name, role_name, privileges, columns)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])`,
    [
      matrix.map((row) => row.table),
      matrix.map((row) => row.role),
      matrix.map((row) => row.privileges.join(' ')),
      matrix.map((row) => row.columns),
    ],
  );
  await client.query(
    `INSERT INTO pg_temp.role_grant_columns (table_name, column_name, column_class)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[])`,
    [
      columns.map((row) => row.table),
      columns.map((row) => row.column),
      columns.map((row) => row.columnClass),
    ],
  );
}

/** Applies the grant table to one schema (the session must own its objects or be superuser). */
export async function applyRoleGrants(client: Client, schemaName: string): Promise<void> {
  await loadRoleGrantInputs(client);
  await client.query("SELECT set_config('dormduri.grant_schema', $1, false)", [schemaName]);
  await client.query(readRoleGrantFile(ROLE_GRANT_FILES.apply));
}

/** Runs the read-only smoke; resolves with the PostgreSQL NOTICE summary line. */
export async function smokeRoleGrants(
  client: Client,
  input: { schemaName: string; expectedTableOwner: string; loginUsers: Record<string, string> },
): Promise<string> {
  await loadRoleGrantInputs(client);
  const loginUsers = Object.entries(input.loginUsers)
    .map(([role, user]) => `${role}=${user}`)
    .join(' ');
  await client.query(
    `SELECT set_config('dormduri.grant_schema', $1, false),
            set_config('dormduri.expected_table_owner', $2, false),
            set_config('dormduri.smoke_login_users', $3, false)`,
    [input.schemaName, input.expectedTableOwner, loginUsers],
  );
  const notices: string[] = [];
  const onNotice = (notice: { message?: string }) => notices.push(notice.message ?? '');
  client.on('notice', onNotice);
  try {
    await client.query('SET default_transaction_read_only = on');
    await client.query(readRoleGrantFile(ROLE_GRANT_FILES.smoke));
  } finally {
    client.off('notice', onNotice);
    await client.query('SET default_transaction_read_only = off');
  }
  return notices.find((message) => message.startsWith('role grant smoke ok')) ?? '';
}

export const PRISMA_SCHEMA_PATH = path.resolve(ROLE_GRANTS_DIR, '../schema.prisma');

const PRISMA_SCALAR_TYPES = new Set([
  'String',
  'Int',
  'BigInt',
  'Float',
  'Decimal',
  'Boolean',
  'DateTime',
  'Json',
  'Bytes',
]);

export interface PrismaSchemaShape {
  models: string[];
  /** Scalar (non-relation) fields as `Model.field`, which are the DB columns. */
  columns: Array<{ table: string; column: string }>;
  /** `@map`/`@@map` on models or fields; the grant pipeline assumes Prisma names = DB names. */
  mappedNames: string[];
  unknownFieldTypes: string[];
}

export function readPrismaSchemaShape(): PrismaSchemaShape {
  const schema = readFileSync(PRISMA_SCHEMA_PATH, 'utf8');
  const modelBlocks = Array.from(
    schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gmu),
    (match) => ({
      name: match[1]!,
      body: match[2]!,
    }),
  );
  const enums = new Set(Array.from(schema.matchAll(/^enum\s+(\w+)\s*\{/gmu), (match) => match[1]!));
  const models = modelBlocks.map((block) => block.name);
  const modelNames = new Set(models);
  const columns: PrismaSchemaShape['columns'] = [];
  const mappedNames: string[] = [];
  const unknownFieldTypes: string[] = [];

  for (const block of modelBlocks) {
    for (const rawLine of block.body.split('\n')) {
      const line = rawLine.trim();
      if (line === '' || line.startsWith('//')) {
        continue;
      }
      if (line.startsWith('@@')) {
        if (line.startsWith('@@map(')) {
          mappedNames.push(block.name);
        }
        continue;
      }
      const field = /^(\w+)\s+(\w+)/u.exec(line);
      if (!field) {
        continue;
      }
      const [, fieldName, fieldType] = field;
      if (modelNames.has(fieldType!)) {
        continue;
      }
      if (!PRISMA_SCALAR_TYPES.has(fieldType!) && !enums.has(fieldType!)) {
        unknownFieldTypes.push(`${block.name}.${fieldName}`);
      }
      if (/@map\(/u.test(line)) {
        mappedNames.push(`${block.name}.${fieldName}`);
      }
      columns.push({ table: block.name, column: fieldName! });
    }
  }

  return { models, columns, mappedNames, unknownFieldTypes };
}
