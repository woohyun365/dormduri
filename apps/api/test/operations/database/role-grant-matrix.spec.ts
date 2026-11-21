import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DATABASE_POOL_MAX,
  DEFAULT_RETENTION_DISCLOSURE_DATABASE_POOL_MAX,
  DEFAULT_RETENTION_WORKER_DATABASE_POOL_MAX,
} from '../../../src/platform/database/database.config.js';
import {
  COLUMN_CLASSES,
  GRANT_PRIVILEGES,
  MANAGED_DATABASE_ROLES,
  readColumnClasses,
  readPrismaSchemaShape,
  readRoleGrantFile,
  readRoleGrantMatrix,
  ROLE_GRANT_FILES,
  type RoleGrantMatrixRow,
} from '../../support/database/role-grant-inputs.js';

// Prisma migrate가 만드는 기록 table의 열(schema.prisma model이 아니다).
const PRISMA_MIGRATIONS_COLUMNS = [
  'id',
  'checksum',
  'finished_at',
  'migration_name',
  'logs',
  'rolled_back_at',
  'started_at',
  'applied_steps_count',
];

const RRPD_TABLES = [
  'RetainedIdentity',
  'RetainedIdentityHold',
  'RetentionCase',
  'RetainedVaultObject',
  'RetainedVaultObjectHold',
  'RetentionAccessLog',
  'RetentionReviewJob',
  'ArchiveJob',
];

// Backoffice admin tables (docs/policies/operator-access.md, decision record db.integrity.role-separation). Only the two backoffice roles write them.
const ADMIN_TABLES = [
  'AdminAccount',
  'AdminPasswordCredential',
  'AdminPasskeyCredential',
  'AdminTotpCredential',
  'AdminRecoveryCode',
  'AdminInvitation',
  'AdminSession',
  'AdminWebAuthnChallenge',
  'AdminRoleAssignment',
  'AdminApprovalRequest',
  'AdminAuditEvent',
];
const ADMIN_CREDENTIAL_TABLES = [
  'AdminPasswordCredential',
  'AdminPasskeyCredential',
  'AdminTotpCredential',
  'AdminRecoveryCode',
];
// Rows the cleanup job removes: 3-year audit and access history, ended auth state after 7 days (data-retention.md DR-R5·DR-R6).
const ADMIN_RETENTION_DELETE_TABLES = [
  'AdminAuditEvent',
  'AdminRoleAssignment',
  'AdminApprovalRequest',
  'AdminSession',
  'AdminWebAuthnChallenge',
  'AdminInvitation',
];
const USER_API_ROLES = ['app_runtime', 'retention_worker', 'retention_disclosure'] as const;

/**
 * role-grant-matrix.csv is the one grant table (infra/db/README.md, Grant 표).
 * apply-role-grants.sql and smoke-role-grants.sql both read it; this guard fails when a
 * model is missing, a row is malformed, or a least-privilege or append-only invariant breaks.
 */
describe('DB role grant table', () => {
  const schema = readPrismaSchemaShape();
  const matrix = readRoleGrantMatrix();
  const classes = readColumnClasses();
  const rowsFor = (table: string, role: string) =>
    matrix.filter((row) => row.table === table && row.role === role);
  const privilegesOf = (table: string, role: string) =>
    new Set(rowsFor(table, role).flatMap((row) => row.privileges));
  const describeRow = (row: RoleGrantMatrixRow) =>
    `${row.table},${row.role},${row.privileges.join(' ')},${row.columns}`;

  it('schema.prisma의 모든 model과 _prisma_migrations가 표에 있고 표에만 있는 table은 없다', () => {
    const tables = new Set(matrix.map((row) => row.table));
    const expected = new Set([...schema.models, '_prisma_migrations']);

    expect(schema.models.length).toBeGreaterThan(0);
    expect([...expected].filter((table) => !tables.has(table))).toEqual([]);
    expect([...tables].filter((table) => !expected.has(table))).toEqual([]);
  });

  it('행마다 role·권한·열 범위가 정한 형식이다', () => {
    const roles = new Set<string>([...MANAGED_DATABASE_ROLES, 'none']);
    const privileges = new Set<string>(GRANT_PRIVILEGES);
    const classNames = new Set<string>(COLUMN_CLASSES);
    const columnsByTable = new Map<string, Set<string>>([
      ['_prisma_migrations', new Set(PRISMA_MIGRATIONS_COLUMNS)],
    ]);
    for (const column of schema.columns) {
      columnsByTable.set(
        column.table,
        (columnsByTable.get(column.table) ?? new Set()).add(column.column),
      );
    }
    const problems: string[] = [];
    const seen = new Set<string>();

    for (const row of matrix) {
      if (!roles.has(row.role)) problems.push(`unknown role: ${describeRow(row)}`);
      if (
        row.role === 'none'
          ? row.privileges.length > 0 || row.columns !== ''
          : row.privileges.length === 0
      ) {
        problems.push(`privileges: ${describeRow(row)}`);
      }
      for (const privilege of row.privileges) {
        if (!privileges.has(privilege)) problems.push(`unknown privilege: ${describeRow(row)}`);
        const scope = `${row.table}|${row.role}|${privilege}|${row.columns === '' ? 'table' : 'columns'}`;
        if (seen.has(scope)) problems.push(`duplicate scope: ${describeRow(row)}`);
        seen.add(scope);
      }
      const tokens = row.columns === '' ? [] : row.columns.split(/\s+/u);
      const exclusions = tokens.filter((token) => token.startsWith('-'));
      if (exclusions.length > 0 && exclusions.length !== tokens.length) {
        problems.push(`mixed columns: ${describeRow(row)}`);
      }
      for (const token of exclusions) {
        if (!classNames.has(token.slice(1))) problems.push(`unknown class: ${describeRow(row)}`);
      }
      for (const token of tokens.filter((value) => !value.startsWith('-'))) {
        if (!columnsByTable.get(row.table)?.has(token))
          problems.push(`unknown column: ${describeRow(row)}`);
      }
    }

    expect(problems).toEqual([]);
  });

  it('runtime은 RRPD payload·식별 복원 table에 권한이 없고 migration 기록은 readiness가 세는 두 열만 읽는다', () => {
    for (const table of RRPD_TABLES.filter((name) => name !== 'RetentionCase')) {
      expect(rowsFor(table, 'app_runtime'), table).toEqual([]);
    }
    // /health/ready counts failed and unfinished migrations on the runtime connection (getDatabaseReadiness.sql).
    // Migration names, checksums and logs stay closed (Owner 2026-11-10).
    expect(rowsFor('_prisma_migrations', 'app_runtime').map(describeRow)).toEqual([
      '_prisma_migrations,app_runtime,SELECT,finished_at rolled_back_at',
    ]);
    const readiness = readFileSync(
      path.resolve(process.cwd(), '../../packages/database/prisma/sql/getDatabaseReadiness.sql'),
      'utf8',
    );
    const used = PRISMA_MIGRATIONS_COLUMNS.filter((column) =>
      new RegExp(`\\b${column}\\b`, 'u').test(readiness),
    );
    expect(used).toEqual(['finished_at', 'rolled_back_at']);
    // Report intake records the retention anchor id in its own transaction.
    expect(rowsFor('RetentionCase', 'app_runtime').map(describeRow)).toEqual([
      'RetentionCase,app_runtime,INSERT,',
      'RetentionCase,app_runtime,SELECT,id',
    ]);
  });

  it('감사 table은 append-only이고 RRPD 열람 기록의 폐기만 worker가 한다', () => {
    for (const role of MANAGED_DATABASE_ROLES) {
      const auditPrivileges = privilegesOf('SeasonOperationAuditEvent', role);
      expect(auditPrivileges.has('UPDATE') || auditPrivileges.has('DELETE'), role).toBe(false);
    }
    expect([...privilegesOf('SeasonOperationAuditEvent', 'app_runtime')].sort()).toEqual([
      'INSERT',
      'SELECT',
    ]);
    for (const role of MANAGED_DATABASE_ROLES.filter((name) => name !== 'retention_worker')) {
      const logPrivileges = privilegesOf('RetentionAccessLog', role);
      expect(logPrivileges.has('UPDATE') || logPrivileges.has('DELETE'), role).toBe(false);
    }
    expect([...privilegesOf('RetentionAccessLog', 'retention_disclosure')].sort()).toEqual([
      'INSERT',
      'SELECT',
    ]);
  });

  it('관리자 table은 백오피스 role 둘만 쓰고 사용자 API credential은 닿지 않는다', () => {
    expect(schema.models.filter((model) => model.startsWith('Admin')).sort()).toEqual(
      [...ADMIN_TABLES].sort(),
    );
    for (const table of ADMIN_TABLES) {
      for (const role of USER_API_ROLES) {
        expect(rowsFor(table, role).map(describeRow), `${table} ${role}`).toEqual([]);
      }
      expect(privilegesOf(table, 'backoffice_runtime').has('SELECT'), table).toBe(true);
    }
  });

  it('관리자 감사는 backoffice_runtime에 append-only이고 폐기·익명화·정리는 backoffice_retention만 한다', () => {
    expect([...privilegesOf('AdminAuditEvent', 'backoffice_runtime')].sort()).toEqual([
      'INSERT',
      'SELECT',
    ]);
    for (const role of MANAGED_DATABASE_ROLES) {
      expect(privilegesOf('AdminAuditEvent', role).has('UPDATE'), role).toBe(false);
      if (role !== 'backoffice_retention') {
        expect(privilegesOf('AdminAuditEvent', role).has('DELETE'), role).toBe(false);
      }
    }

    const retentionRows = rowsFor('AdminAuditEvent', 'backoffice_retention').concat(
      ...ADMIN_TABLES.filter((table) => table !== 'AdminAuditEvent').map((table) =>
        rowsFor(table, 'backoffice_retention'),
      ),
    );
    // Cleanup never writes new rows and never rewrites access history.
    expect(
      retentionRows.filter((row) => row.privileges.includes('INSERT')).map(describeRow),
    ).toEqual([]);
    expect(
      ADMIN_TABLES.filter((table) =>
        privilegesOf(table, 'backoffice_retention').has('DELETE'),
      ).sort(),
    ).toEqual([...ADMIN_RETENTION_DELETE_TABLES].sort());
    // The only UPDATE is the anonymization of a deactivated account (data-retention.md DR-R5).
    expect(
      retentionRows.filter((row) => row.privileges.includes('UPDATE')).map(describeRow),
    ).toEqual([
      'AdminAccount,backoffice_retention,UPDATE,email displayName anonymizedAt updatedAt',
    ]);
    // It reads only the columns its conditions need: no table-level SELECT, no secret or content column.
    const classOf = new Map(classes.map((row) => [`${row.table}.${row.column}`, row.columnClass]));
    const selectRows = retentionRows.filter((row) => row.privileges.includes('SELECT'));
    expect(selectRows.filter((row) => row.columns === '').map(describeRow)).toEqual([]);
    expect(
      selectRows.flatMap((row) =>
        row.columns
          .split(/\s+/u)
          .filter((column) =>
            ['secret', 'content', 'identifier'].includes(
              classOf.get(`${row.table}.${column}`) ?? '',
            ),
          )
          .map((column) => `${row.table}.${column}`),
      ),
    ).toEqual([]);
  });

  it('backoffice_runtime은 감사·권한 내역을 지우지 않고 계정 익명화 열을 고치지 않는다', () => {
    for (const table of ADMIN_TABLES.filter((name) => !ADMIN_CREDENTIAL_TABLES.includes(name))) {
      expect(privilegesOf(table, 'backoffice_runtime').has('DELETE'), table).toBe(false);
    }
    // Deactivation deletes every credential at once (operator-access.md OA-R6).
    for (const table of ADMIN_CREDENTIAL_TABLES) {
      expect(privilegesOf(table, 'backoffice_runtime').has('DELETE'), table).toBe(true);
    }
    const accountUpdate = rowsFor('AdminAccount', 'backoffice_runtime').filter((row) =>
      row.privileges.includes('UPDATE'),
    );
    expect(accountUpdate).toHaveLength(1);
    expect(accountUpdate[0]!.columns, 'column-level UPDATE').not.toBe('');
    for (const column of ['email', 'displayName', 'anonymizedAt']) {
      expect(accountUpdate[0]!.columns.split(/\s+/u), column).not.toContain(column);
    }
  });

  it('사람 조회 role은 읽기만 하고 model table에서는 secret·content 열을 뺀다', () => {
    const readonlyRows = matrix.filter((row) => row.role === 'app_readonly');

    expect(
      readonlyRows.flatMap((row) => row.privileges).filter((privilege) => privilege !== 'SELECT'),
    ).toEqual([]);
    // RRPD stays closed to people except the RetentionCase anchor id, which the restore drill
    // counts against the source (Owner 2026-11-08).
    const restoreDrillAnchor = (row: (typeof readonlyRows)[number]) =>
      row.table === 'RetentionCase' && row.columns === 'id';
    expect(readonlyRows.filter((row) => RRPD_TABLES.includes(row.table)).map(describeRow)).toEqual(
      readonlyRows.filter(restoreDrillAnchor).map(describeRow),
    );
    expect(readonlyRows.filter(restoreDrillAnchor)).toHaveLength(1);
    expect(
      readonlyRows
        .filter((row) => row.table !== '_prisma_migrations' && !restoreDrillAnchor(row))
        .filter(
          (row) =>
            !(
              row.columns.split(/\s+/u).includes('-secret') &&
              row.columns.split(/\s+/u).includes('-content')
            ),
        )
        .map(describeRow),
    ).toEqual([]);
    // Every model table except RRPD is readable for operations without secret·content.
    expect(
      schema.models.filter(
        (model) => !RRPD_TABLES.includes(model) && rowsFor(model, 'app_readonly').length === 0,
      ),
    ).toEqual([]);
  });

  it('worker·disclosure·backoffice는 정한 범위 밖 권한을 받지 않는다', () => {
    // Nothing reads AuthMailOutboxEvent with the worker credential (F7).
    expect(rowsFor('AuthMailOutboxEvent', 'retention_worker')).toEqual([]);
    // Backoffice roles reach only the admin tables; user tables and RRPD arrive per feature (infra/db/README.md, new role step).
    expect(
      matrix
        .filter((row) => row.role === 'backoffice_runtime' || row.role === 'backoffice_retention')
        .filter((row) => !ADMIN_TABLES.includes(row.table))
        .map(describeRow),
    ).toEqual([]);
    expect(
      matrix
        .filter((row) => row.role === 'retention_disclosure')
        .filter((row) => row.privileges.some((privilege) => privilege !== 'SELECT'))
        .map(describeRow),
    ).toEqual([
      'RetentionAccessLog,retention_disclosure,SELECT INSERT,',
      'RetentionReviewJob,retention_disclosure,SELECT INSERT UPDATE,',
    ]);
    expect(
      matrix
        .filter((row) => row.role === 'retention_disclosure')
        .filter((row) => !RRPD_TABLES.includes(row.table))
        .map(describeRow),
    ).toEqual([]);
  });

  it('열 분류가 표의 제외 규칙이 쓰는 모든 table을 덮는다', () => {
    const classifiedTables = new Set(classes.map((row) => row.table));
    expect(
      matrix
        .filter((row) => row.columns.startsWith('-') && !classifiedTables.has(row.table))
        .map(describeRow),
    ).toEqual([]);
  });
});

describe('DB role grant SQL artifacts', () => {
  const bootstrap = readRoleGrantFile(ROLE_GRANT_FILES.bootstrap);
  const defaults = readRoleGrantFile(ROLE_GRANT_FILES.databaseDefaults);
  const defaultsStatements = defaults
    .split('\n')
    .filter((line) => !line.startsWith('--'))
    .join('\n');
  const apply = readRoleGrantFile(ROLE_GRANT_FILES.apply);
  const smoke = readRoleGrantFile(ROLE_GRANT_FILES.smoke);
  const inputs = readRoleGrantFile(ROLE_GRANT_FILES.inputs);

  it('bootstrap은 비밀번호 없이 group role·LOGIN user·membership·접속 상한을 만든다', () => {
    expect(bootstrap).not.toMatch(/\bPASSWORD\b/u);
    for (const role of ['migration_owner', ...MANAGED_DATABASE_ROLES]) {
      expect(bootstrap).toContain(`'${role}'`);
    }
    // LOGIN user, group, CONNECTION LIMIT (infra/db/README.md, Role과 LOGIN user).
    for (const user of [
      "ARRAY['dormduri_migrator', 'migration_owner', '3', 'set']",
      "ARRAY['dormduri_api', 'app_runtime', '16', 'noset']",
      "ARRAY['dormduri_retention_worker', 'retention_worker', '8', 'noset']",
      "ARRAY['dormduri_api_disclosure', 'retention_disclosure', '4', 'noset']",
      "ARRAY['dormduri_backoffice', 'backoffice_runtime', '12', 'noset']",
      "ARRAY['dormduri_backoffice_retention', 'backoffice_retention', '4', 'noset']",
    ]) {
      expect(bootstrap).toContain(user);
    }
    expect(bootstrap).toContain(
      "'ALTER ROLE %I SET role = %L', 'dormduri_migrator', 'migration_owner'",
    );
    expect(bootstrap).toContain("'ALTER ROLE %I SET pgaudit.log = %L', human_user, 'all'");
    expect(bootstrap).toContain("'ALTER ROLE %I SET pgaudit.log = %L', session_user, 'all'");
    expect(bootstrap).toContain("'dormduri_ro_' || alias");
    expect(bootstrap).toContain('GRANT USAGE, CREATE ON SCHEMA %I TO %I WITH GRANT OPTION');
    expect(bootstrap).toContain(
      "'GRANT CREATE ON DATABASE %I TO %I', current_database(), 'migration_owner'",
    );
  });

  it('default privilege는 migration_owner 전역 형태로 PUBLIC 함수 실행만 막는다', () => {
    expect(defaults).toContain(
      'ALTER DEFAULT PRIVILEGES FOR ROLE migration_owner REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;',
    );
    expect(defaultsStatements).not.toMatch(/\bIN SCHEMA\b/u);
    expect(defaultsStatements).not.toMatch(/\bGRANT\b/u);
  });

  it('입력 SQL의 관리 role 목록이 test의 목록과 같다(새 role은 둘에 함께 더한다)', () => {
    const managed = /role_grant_managed_roles\(\)[\s\S]*?SELECT ARRAY\[([^\]]*)\]/u.exec(
      inputs,
    )?.[1];
    expect(managed?.split(',').map((name) => name.trim().replaceAll("'", ''))).toEqual([
      ...MANAGED_DATABASE_ROLES,
    ]);
  });

  it('apply는 입력 검증 뒤 PUBLIC·관리 role 권한을 모두 지우고 표의 권한만 준다', () => {
    expect(apply).toContain('pg_temp.role_grant_input_problems(target_schema)');
    expect(apply).toContain("'REVOKE ALL ON TABLE %I.%I FROM PUBLIC, %s'");
    expect(apply).toContain('pg_temp.role_grant_expected(target_schema)');
    expect(apply).not.toMatch(/GRANT ALL\b/u);
    expect(inputs).toContain("format('relation %s is not in role-grant-matrix.csv'");
    expect(inputs).toContain("format('column %s.%s is not in column-classes.csv'");
    expect(inputs).toContain("format('sequence %s needs a grant rule'");
  });

  it('smoke는 같은 펼침을 읽고 PUBLIC·관리 role·LOGIN user의 table·열 권한을 모두 비교한다', () => {
    expect(smoke).toContain('pg_temp.role_grant_expected(target_schema)');
    expect(smoke).toContain('has_table_privilege(s.subject, r.relation_oid, p.privilege_type)');
    expect(smoke).toContain(
      'has_column_privilege(s.subject, r.relation_oid, a.attnum, p.privilege_type)',
    );
    expect(smoke).toContain(
      "'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'",
    );
    expect(smoke).toContain("pg_has_role(l.subject, o.other_role, 'MEMBER')");
    // PostgreSQL 17+ MAINTAIN, human LOGIN users' memberships, direct grants, default ACL.
    expect(smoke).toContain("ARRAY['MAINTAIN']");
    expect(smoke).toContain('FROM usable_memberships u');
    // LOGIN users without a smoke URL join the table·column comparison by role name.
    expect(inputs).toMatch(/unlisted AS \([\s\S]*HAVING count\(\*\) = 1/u);
    expect(smoke).toContain("format('%s has a direct grant on %s'");
    expect(smoke).toContain("'migration_owner default privileges grant %s on new %s to %s'");
    // Problem lines are compared by text: an aggregate ORDER BY <number> sorts by a constant, not a column.
    for (const source of [smoke, apply, inputs]) {
      expect(source).not.toMatch(/ORDER BY \d+\s*\)/u);
    }
    expect(smoke).toContain('default_transaction_read_only');
  });
});

/**
 * Connection budget (infra/db/README.md, Connection budget, #238): a service LOGIN user's CONNECTION LIMIT is
 * pool × 2 + 2 (old and new container overlap) and a one-off or human user's is pool + 1. The code default pool,
 * the two deploy env examples, the bootstrap SQL and the README Credential boundary table carry the same numbers.
 */
describe('DB connection budget', () => {
  const bootstrap = readRoleGrantFile(ROLE_GRANT_FILES.bootstrap);
  const repoRoot = path.resolve(process.cwd(), '../..');
  const readme = readFileSync(path.join(repoRoot, 'infra/db/README.md'), 'utf8');
  const bootstrapLimit = (user: string): number => {
    const match = new RegExp(
      `ARRAY\\['${user}', '[a-z_]+', '(\\d+)', '(?:set|noset)'\\]`,
      'u',
    ).exec(bootstrap);
    if (!match?.[1]) throw new Error(`no bootstrap row for ${user}`);
    return Number(match[1]);
  };
  const readmeLimit = (user: string): number => {
    const row = readme
      .split('\n')
      .find((line) => line.startsWith('|') && line.includes(`\`${user}\``));
    const cells = row?.split('|').map((cell) => cell.trim());
    const value = cells?.at(-2);
    if (!value || !/^\d+$/u.test(value)) throw new Error(`no README limit for ${user}`);
    return Number(value);
  };
  const envPool = (file: string, key: string): number => {
    const line = readFileSync(path.join(repoRoot, 'infra/deploy', file), 'utf8')
      .split('\n')
      .find((entry) => entry.startsWith(`${key}=`));
    if (!line) throw new Error(`${file} has no ${key}`);
    return Number(line.slice(key.length + 1));
  };

  it('service user CONNECTION LIMIT은 code 기본 pool × 2 + 2이고 env 예시 둘이 같은 pool을 쓴다', () => {
    const pools = [
      ['dormduri_api', 'DATABASE_POOL_MAX', DEFAULT_DATABASE_POOL_MAX],
      [
        'dormduri_retention_worker',
        'RETENTION_WORKER_DATABASE_POOL_MAX',
        DEFAULT_RETENTION_WORKER_DATABASE_POOL_MAX,
      ],
      [
        'dormduri_api_disclosure',
        'RETENTION_DISCLOSURE_DATABASE_POOL_MAX',
        DEFAULT_RETENTION_DISCLOSURE_DATABASE_POOL_MAX,
      ],
    ] as const;
    // Owner 2026-11-09(#238): db.t4g.micro max_connections 78이라 사용자 API runtime pool은 7이다.
    expect(DEFAULT_DATABASE_POOL_MAX).toBe(7);
    for (const [user, key, pool] of pools) {
      expect(bootstrapLimit(user), user).toBe(pool * 2 + 2);
      for (const file of ['.env.api.example', '.env.api.lightsail.example']) {
        expect(envPool(file, key), `${file} ${key}`).toBe(pool);
      }
    }
  });

  it('README Credential boundary 표의 CONNECTION LIMIT은 bootstrap SQL과 같다', () => {
    for (const user of [
      'dormduri_migrator',
      'dormduri_api',
      'dormduri_retention_worker',
      'dormduri_api_disclosure',
      'dormduri_backoffice',
      'dormduri_backoffice_retention',
    ]) {
      expect(readmeLimit(user), user).toBe(bootstrapLimit(user));
    }
    expect(readme).toMatch(/예약 연결 5/u);
  });

  it('백오피스 user CONNECTION LIMIT은 예산 표 pool × 2 + 2이고 예산 합이 max_connections × 0.6 이하다', () => {
    // The backoffice API pool defaults arrive with apps/backoffice-api; until then the budget table is the source.
    const budgetPools = (label: string): number[] => {
      const row = readme
        .split('\n')
        .find((line) => line.startsWith('|') && line.split('|')[1]?.trim() === label);
      const cell = row?.split('|')[2]?.trim();
      if (!cell || !/^\d+( \/ \d+)*$/u.test(cell)) throw new Error(`no budget row for ${label}`);
      return cell.split(' / ').map(Number);
    };
    const userApi = budgetPools('사용자 API runtime / worker / disclosure');
    const backoffice = budgetPools('백오피스 API runtime / 정리 / disclosure');
    const [migration] = budgetPools('migration(one-off)');
    const [human] = budgetPools('사람 조회');
    expect(userApi).toEqual([
      DEFAULT_DATABASE_POOL_MAX,
      DEFAULT_RETENTION_WORKER_DATABASE_POOL_MAX,
      DEFAULT_RETENTION_DISCLOSURE_DATABASE_POOL_MAX,
    ]);
    const [backofficeRuntime, backofficeRetention] = backoffice as [number, number, number];
    expect(bootstrapLimit('dormduri_backoffice')).toBe(backofficeRuntime * 2 + 2);
    expect(bootstrapLimit('dormduri_backoffice_retention')).toBe(backofficeRetention * 2 + 2);

    const maxConnections = Number(/`max_connections` (\d+)/u.exec(readme)?.[1]);
    const reserved = Number(/예약 연결 (\d+)/u.exec(readme)?.[1]);
    const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
    const total = (sum(userApi) + sum(backoffice)) * 2 + migration! + human! + reserved;
    expect(maxConnections).toBe(78);
    expect(total).toBeLessThanOrEqual(maxConnections * 0.6);
  });
});
