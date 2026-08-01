import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(CURRENT_DIR, '../../../prisma/schema.prisma');
const SQL_DIR_PATH = path.resolve(CURRENT_DIR, '../../../prisma/sql');
const LOGIN_ATTEMPT_SQL_PATH = path.resolve(
  CURRENT_DIR,
  '../../../prisma/sql/recordLoginFailure.sql',
);
const SQL_WRITE_FILES = [
  'claimAuthMailOutboxEvents.sql',
  'claimChatRealtimeOutboxEvents.sql',
  'claimNotificationOutboxEvents.sql',
  'claimRetentionArchiveJobs.sql',
  'claimRetentionReviewJobs.sql',
  'disposeDueRetentionAccessLogs.sql',
  'markVerificationCodeVerified.sql',
  'recordLoginFailure.sql',
  'recordVerificationCodeFailure.sql',
] as const;
const UPDATED_AT_OWNED_WRITE_SQL_FILES = [
  'claimAuthMailOutboxEvents.sql',
  'claimChatRealtimeOutboxEvents.sql',
  'claimNotificationOutboxEvents.sql',
  'claimRetentionArchiveJobs.sql',
  'claimRetentionReviewJobs.sql',
  'recordLoginFailure.sql',
] as const;

describe('updatedAt ownership coverage', () => {
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  const loginAttemptSql = readFileSync(LOGIN_ATTEMPT_SQL_PATH, 'utf8');

  it('모든 updatedAt 필드는 Prisma @updatedAt로 선언된다', () => {
    const modelBlocks = Array.from(
      schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g),
      (match) => ({
        modelName: match[1]!,
        body: match[2]!,
      }),
    );

    const updatedAtModels = modelBlocks
      .filter((block) => /^\s*updatedAt\s+DateTime/m.test(block.body))
      .map((block) => ({
        modelName: block.modelName,
        hasPrismaUpdatedAt: /^\s*updatedAt\s+DateTime[^\n]*@updatedAt/m.test(block.body),
      }));

    const uncovered = updatedAtModels
      .filter((item) => !item.hasPrismaUpdatedAt)
      .map((item) => item.modelName);

    expect(uncovered).toEqual([]);
  });

  it('raw SQL write 모델은 SQL이 직접 updatedAt를 세팅한다', () => {
    expect(loginAttemptSql).toContain('"updatedAt" = NOW()');
  });

  it('updatedAt 모델을 쓰는 raw SQL은 SQL이 직접 updatedAt를 세팅한다', () => {
    const missingUpdatedAtWrites = UPDATED_AT_OWNED_WRITE_SQL_FILES.filter((fileName) => {
      const content = readFileSync(path.join(SQL_DIR_PATH, fileName), 'utf8');

      return !/"updatedAt"\s*=\s*(NOW\(\)|\$\d+)/.test(content);
    });

    expect(missingUpdatedAtWrites).toEqual([]);
  });

  it('현재 runtime raw SQL write 파일 목록을 명시적으로 고정한다', () => {
    const writeSqlFiles = readdirSync(SQL_DIR_PATH).filter((fileName) => {
      const content = readFileSync(path.join(SQL_DIR_PATH, fileName), 'utf8');
      return /^\s*(INSERT INTO|UPDATE)\b/m.test(content);
    });

    expect(writeSqlFiles.sort()).toEqual([...SQL_WRITE_FILES].sort());
  });
});
