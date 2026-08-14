import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const schemaPath = join(apiRoot, 'prisma/schema.prisma');
const baselineMigrationPath = join(
  apiRoot,
  'prisma/migrations/000000000000_initial_baseline/migration.sql',
);

function read(path: string) {
  return readFileSync(path, 'utf8');
}

describe('social-safety persistence baseline', () => {
  it('keeps bookmark and block relations with active-record indexes', () => {
    const schema = read(schemaPath);
    const migration = read(baselineMigrationPath);

    expect(schema).toContain('model UserBookmark');
    expect(schema).toContain('model UserBlock');
    expect(schema).toContain('model UserBlockEvent');
    expect(schema).toContain(
      '@@index([viewerUserId, seasonId, deletedAt, expiredAt, bookmarkedAt, id])',
    );
    expect(schema).toContain('@@index([blockerUserId, unblockedAt, blockedAt, id])');
    expect(migration).toContain('UserBookmark_viewerUserId_seasonId_targetParticipant_active_key');
    expect(migration).toContain('WHERE "deletedAt" IS NULL AND "expiredAt" IS NULL');
    expect(migration).toContain('UserBlock_blockerUserId_blockedUserId_active_key');
    expect(migration).toContain('WHERE "unblockedAt" IS NULL');
  });

  it('keeps report intake records, event allowlist, and open-case indexes', () => {
    const schema = read(schemaPath);
    const migration = read(baselineMigrationPath);

    expect(schema).toContain('model ReportCase');
    expect(schema).toContain('model ReportCaseEvent');
    expect(schema).toContain('PROFILE_MISMATCH_FEEDBACK_CANDIDATE_RECORDED');
    expect(schema).toContain('UNVERIFIED_ATTACHMENT_POINTERS_RECORDED');
    expect(migration).toContain('ReportCase_reporter_target_reason_open_key');
    expect(migration).toContain("WHERE \"status\" IN ('SUBMITTED', 'EVIDENCE_ONLY')");
    expect(migration).toContain('ReportCase_targetType_targetId_status_receivedAt_id_idx');
  });
});
