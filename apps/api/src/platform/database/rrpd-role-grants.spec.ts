import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('RRPD DB role grants SQL artifact', () => {
  const sqlPath = path.resolve(process.cwd(), 'prisma/role-grants/rrpd-role-grants.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  it('runtime role에서 RRPD table 권한을 회수하고 일반 table만 grant한다', () => {
    expect(sql).toContain('rrpd_tables text[]');
    expect(sql).toContain('RetainedVaultObject');
    expect(sql).toContain('RetainedIdentity');
    expect(sql).toContain('RetentionAccessLog');
    expect(sql).toContain('REVOKE ALL ON TABLE %I.%I FROM %I, %I, %I');
    expect(sql).toContain('IF table_name = ANY(rrpd_tables) THEN');
    expect(sql).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO %I', target_schema, table_name, app_runtime_role",
    );
  });

  it('retention worker와 disclosure role의 책임을 분리한다', () => {
    expect(sql).toContain('retention_worker_role');
    expect(sql).toContain('retention_disclosure_role');
    expect(sql).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO %I', target_schema, table_name, retention_worker_role",
    );
    expect(sql).toContain(
      "GRANT SELECT, INSERT ON TABLE %I.%I TO %I', target_schema, 'RetentionAccessLog', retention_disclosure_role",
    );
    expect(sql).toContain(
      "GRANT SELECT, INSERT, UPDATE ON TABLE %I.%I TO %I', target_schema, 'RetentionReviewJob', retention_disclosure_role",
    );
  });
});
