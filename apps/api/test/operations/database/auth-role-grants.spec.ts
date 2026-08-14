import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const sqlPath = path.resolve(process.cwd(), 'prisma/role-grants/auth-role-grants.sql');
const sql = readFileSync(sqlPath, 'utf8');

describe('Auth DB role grants SQL artifact', () => {
  it('runtime/retention/read-only/migration credential boundary를 분리한다', () => {
    expect(sql).toContain('app_runtime_role');
    expect(sql).toContain('retention_worker_role');
    expect(sql).toContain('app_readonly_role');
    expect(sql).toContain('migration_role');
    expect(sql).toContain('MIGRATION_DATABASE_URL/DIRECT_URL');
    expect(sql).toContain(
      'PrismaModule executes auth cleanup through RetentionWorkerPrismaService',
    );
    expect(sql).not.toContain('auth_cleanup_worker_role');
    expect(sql).toContain('Application RBAC remains the canonical user/action authorization layer');
  });

  it('retention worker는 TTL delete와 outbox lag read 권한을 받고 read-only는 write를 받지 않는다', () => {
    for (const table of [
      'LoginAttempt',
      'VerificationCode',
      'VerificationCodeRequestLog',
      'AuthSession',
      'AuthSecurityEvent',
    ]) {
      expect(sql).toContain(`'${table}'`);
    }
    expect(sql).toContain("auth_outbox_tables text[] := ARRAY['AuthMailOutboxEvent']");

    expect(sql).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO %I', target_schema, table_name, app_runtime_role",
    );
    expect(sql).toContain(
      "GRANT SELECT, DELETE ON TABLE %I.%I TO %I', target_schema, table_name, retention_worker_role",
    );
    expect(sql).toContain(
      "GRANT SELECT ON TABLE %I.%I TO %I', target_schema, table_name, app_readonly_role",
    );
    expect(sql).toContain(
      "GRANT SELECT ON TABLE %I.%I TO %I', target_schema, table_name, retention_worker_role",
    );
    expect(sql).not.toContain(
      "GRANT INSERT ON TABLE %I.%I TO %I', target_schema, table_name, app_readonly_role",
    );
    expect(sql).not.toContain(
      "GRANT UPDATE ON TABLE %I.%I TO %I', target_schema, table_name, app_readonly_role",
    );
    expect(sql).not.toContain(
      "GRANT DELETE ON TABLE %I.%I TO %I', target_schema, table_name, app_readonly_role",
    );
    expect(sql).not.toContain('GRANT CREATE ON SCHEMA %I TO %I, %I, %I');
  });
});
