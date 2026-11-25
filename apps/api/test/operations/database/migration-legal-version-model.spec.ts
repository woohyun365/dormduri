import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(
  CURRENT_DIR,
  '../../../../../packages/database/prisma/migrations',
);

const normalize = (sql: string) => sql.replace(/\s+/gu, ' ');

function readLegalVersionModelMigration(): string {
  const directories = readdirSync(MIGRATIONS_DIR).filter((name) =>
    /^\d{14}_legal_version_model$/u.test(name),
  );
  expect(directories, 'one legal version model migration').toHaveLength(1);
  return normalize(
    readFileSync(path.join(MIGRATIONS_DIR, directories[0]!, 'migration.sql'), 'utf8'),
  );
}

describe('legal version model migration', () => {
  it('철회되지 않은 (kind, 시행일)과 kind당 첫 게시를 부분 unique로 막는다', () => {
    const sql = readLegalVersionModelMigration();

    expect(sql).toContain(
      'CREATE UNIQUE INDEX "LegalDocumentVersion_kind_effectiveDate_active_key" ON "LegalDocumentVersion"("kind", "effectiveDate") WHERE "withdrawnAt" IS NULL;',
    );
    expect(sql).toContain(
      `CREATE UNIQUE INDEX "LegalDocumentVersion_kind_initial_key" ON "LegalDocumentVersion"("kind") WHERE "noticeClass" = 'INITIAL';`,
    );
  });

  it('지금 행의 시행일은 KST 날짜로 옮기고 kind별 가장 이른 행을 첫 게시로 둔다', () => {
    const sql = readLegalVersionModelMigration();

    expect(sql).toContain(`("effectiveAt" AT TIME ZONE 'Asia/Seoul')::date`);
    expect(sql).toMatch(
      /ROW_NUMBER\(\) OVER \(PARTITION BY "kind" ORDER BY "effectiveAt", "id"\)/u,
    );
    // An old retirement hid a superseded version, which is now a previous version: none is withdrawn.
    expect(sql).toContain(
      'ALTER TABLE "LegalDocumentVersion" DROP COLUMN "retiredAt", ADD COLUMN "withdrawnAt" TIMESTAMPTZ(3);',
    );
    expect(sql).not.toMatch(/RENAME COLUMN "retiredAt"/u);
    // Existing rows are body format 1 and the digest covers that format.
    expect(sql).toContain('ADD COLUMN "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1,');
    expect(sql).toContain(
      'jsonb_build_array( "kind", "contentSchemaVersion", "title", "summaryItems", "sections", "changeSummary", "effectiveDate", NULL, "noticeClass", "consentRequired" )::text',
    );
  });

  it('회원 수 view는 탈퇴하지 않은 사용자 수 하나만 낸다', () => {
    const sql = readLegalVersionModelMigration();

    expect(sql).toContain(
      'CREATE VIEW "LegalNoticeRecipientCount" AS SELECT count(*)::integer AS "recipientCount" FROM "User" WHERE "deletedAt" IS NULL;',
    );
  });

  it('백오피스 승인·감사 enum에 legal 값을 더하고 새 값은 같은 migration에서 text로만 비교한다', () => {
    const sql = readLegalVersionModelMigration();

    for (const statement of [
      `ALTER TYPE "AdminApprovalRequestKind" ADD VALUE 'LEGAL_PUBLISH';`,
      `ALTER TYPE "AdminApprovalRequestKind" ADD VALUE 'LEGAL_WITHDRAW';`,
      `ALTER TYPE "AdminAuditTargetType" ADD VALUE 'LEGAL_DOCUMENT_DRAFT';`,
      `ALTER TYPE "AdminAuditTargetType" ADD VALUE 'LEGAL_DOCUMENT_VERSION';`,
    ]) {
      expect(sql).toContain(statement);
    }
    expect(sql).toContain(
      `ADD CONSTRAINT "AdminApprovalRequest_legal_target_check" CHECK ( ("kind"::text = 'LEGAL_PUBLISH') = ("targetLegalDraftId" IS NOT NULL) AND ("kind"::text = 'LEGAL_WITHDRAW') = ("targetLegalVersionId" IS NOT NULL) );`,
    );
    expect(sql).not.toMatch(/"kind" (?:=|IN) \(?'LEGAL_/u);
  });
});
