import { describe, expect, it } from 'vitest';
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
    const columnsByTable = new Map<string, Set<string>>();
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

  it('runtime은 RRPD payload·식별 복원 table과 migration 기록에 권한이 없다', () => {
    for (const table of RRPD_TABLES.filter((name) => name !== 'RetentionCase')) {
      expect(rowsFor(table, 'app_runtime'), table).toEqual([]);
    }
    expect(rowsFor('_prisma_migrations', 'app_runtime')).toEqual([]);
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

  it('사람 조회 role은 읽기만 하고 model table에서는 secret·content 열을 뺀다', () => {
    const readonlyRows = matrix.filter((row) => row.role === 'app_readonly');

    expect(
      readonlyRows.flatMap((row) => row.privileges).filter((privilege) => privilege !== 'SELECT'),
    ).toEqual([]);
    expect(readonlyRows.filter((row) => RRPD_TABLES.includes(row.table))).toEqual([]);
    expect(
      readonlyRows
        .filter((row) => row.table !== '_prisma_migrations')
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
    // Backoffice table access arrives per feature with column grants (O1·L1).
    expect(matrix.filter((row) => row.role === 'backoffice_runtime')).toEqual([]);
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
      "ARRAY['dormduri_api', 'app_runtime', '22', 'noset']",
      "ARRAY['dormduri_retention_worker', 'retention_worker', '8', 'noset']",
      "ARRAY['dormduri_api_disclosure', 'retention_disclosure', '4', 'noset']",
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
    expect(smoke).toContain("format('%s has a direct grant on %s'");
    expect(smoke).toContain("'migration_owner default privileges grant %s on new %s to %s'");
    expect(smoke).toContain('default_transaction_read_only');
  });
});
