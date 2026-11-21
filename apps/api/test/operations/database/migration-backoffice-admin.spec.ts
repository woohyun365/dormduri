import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKOFFICE_ADMIN_MIGRATION_PATH = path.resolve(
  CURRENT_DIR,
  '../../../../../packages/database/prisma/migrations/20261121000000_backoffice_admin_foundation/migration.sql',
);

// The audit FKs restrict both delete and update of the parent, so neither a parent delete nor a
// parent id change rewrites an append-only audit row (#868, decision record db.integrity.audit-tables).
const AUDIT_FOREIGN_KEYS = [
  ['SeasonOperationAuditEvent', 'SeasonOperationAuditEvent_seasonId_fkey', '"Season"("id")'],
  ['AdminAuditEvent', 'AdminAuditEvent_actorAccountId_fkey', '"AdminAccount"("id")'],
  ['AdminAuditEvent', 'AdminAuditEvent_approvalRequestId_fkey', '"AdminApprovalRequest"("id")'],
] as const;

const normalize = (sql: string) => sql.replace(/\s+/gu, ' ');

describe('backoffice admin migration', () => {
  const sql = normalize(readFileSync(BACKOFFICE_ADMIN_MIGRATION_PATH, 'utf8'));

  it('감사 FK는 부모의 삭제와 id 변경을 모두 막는다', () => {
    expect(sql).toContain(
      'ALTER TABLE "SeasonOperationAuditEvent" DROP CONSTRAINT "SeasonOperationAuditEvent_seasonId_fkey";',
    );
    for (const [table, name, parent] of AUDIT_FOREIGN_KEYS) {
      const definitions = sql.match(new RegExp(`ADD CONSTRAINT "${name}" [^;]*;`, 'gu')) ?? [];
      expect(definitions, name).toHaveLength(1);
      expect(definitions[0], name).toContain(
        `REFERENCES ${parent} ON DELETE RESTRICT ON UPDATE RESTRICT;`,
      );
      expect(sql, name).toContain(`ALTER TABLE "${table}" ADD CONSTRAINT "${name}"`);
    }
  });

  it('같은 계정·역할의 활성 부여는 하나이고 정리 조건이 기대는 상태·시각 짝을 DB가 막는다', () => {
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "AdminRoleAssignment_accountId_role_active_key" ON "AdminRoleAssignment"("accountId", "role") WHERE "revokedAt" IS NULL;',
    );
    for (const constraint of [
      `ADD CONSTRAINT "AdminApprovalRequest_role_target_check" CHECK ( "kind" NOT IN ('ROLE_GRANT', 'ROLE_REVOKE') OR ("targetAccountId" IS NOT NULL AND "targetRole" IS NOT NULL) );`,
      `ADD CONSTRAINT "AdminApprovalRequest_closed_check" CHECK (("status" = 'PENDING') = ("closedAt" IS NULL));`,
      `ADD CONSTRAINT "AdminAccount_deactivated_check" CHECK (("status" = 'DEACTIVATED') = ("deactivatedAt" IS NOT NULL));`,
      `ADD CONSTRAINT "AdminAccount_anonymized_check" CHECK ("anonymizedAt" IS NULL OR "status" = 'DEACTIVATED');`,
      `ADD CONSTRAINT "AdminSession_revocation_pair_check" CHECK (("revokedAt" IS NULL) = ("revocationReason" IS NULL));`,
      `ADD CONSTRAINT "AdminAuditEvent_actor_check" CHECK (("actorType" = 'ADMIN') = ("actorAccountId" IS NOT NULL));`,
    ]) {
      expect(sql).toContain(constraint);
    }
  });
});
