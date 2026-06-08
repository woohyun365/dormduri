import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const apiRoot = process.cwd();
const schemaPath = join(apiRoot, 'prisma/schema.prisma');
const baselineMigrationPath = join(
  apiRoot,
  'prisma/migrations/000000000000_initial_baseline/migration.sql',
);

function read(path: string) {
  return readFileSync(path, 'utf8');
}

describe('Phase 2 social-safety Prisma baseline', () => {
  it('keeps UserBookmark model and relation/index fields in Prisma schema', () => {
    const source = read(schemaPath);

    expect(source).toContain('model UserBookmark');
    expect(source).toContain('viewerUserId');
    expect(source).toContain('targetUserId');
    expect(source).toContain('targetParticipantId');
    expect(source).toContain('deletedAt');
    expect(source).toContain('expiredAt');
    expect(source).toContain(
      '@@index([viewerUserId, seasonId, deletedAt, expiredAt, bookmarkedAt, id])',
    );
  });

  it('keeps active bookmark dedupe and list indexes in baseline SQL as partial indexes', () => {
    const source = read(baselineMigrationPath);

    expect(source).toContain('CREATE TABLE "UserBookmark"');
    expect(source).toContain('UserBookmark_viewerUserId_seasonId_targetParticipant_active_key');
    expect(source).toContain(
      'ON "UserBookmark"("viewerUserId", "seasonId", "targetParticipantId")',
    );
    expect(source).toContain('WHERE "deletedAt" IS NULL AND "expiredAt" IS NULL');
    expect(source).toContain('UserBookmark_active_list_cursor_idx');
    expect(source).toContain('"bookmarkedAt" DESC, "id" DESC');
    expect(source).toContain('UserBookmark_active_block_cleanup_idx');
  });
});
