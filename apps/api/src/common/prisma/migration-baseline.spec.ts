import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_MIGRATION_PATH = path.resolve(
  CURRENT_DIR,
  '../../../prisma/migrations/000000000000_initial_baseline/migration.sql',
);

describe('migration baseline coverage', () => {
  const sql = readFileSync(BASELINE_MIGRATION_PATH, 'utf8');

  it('현재 schema에 필요한 핵심 enum/table/index/constraint를 모두 포함한다', () => {
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    expect(sql).toContain(
      `CREATE TYPE "SeasonOverrideState" AS ENUM ('OFF_SEASON', 'SEASON_OPEN', 'SEASON_MATCHING', 'SEASON_POST_MATCH');`,
    );
    expect(sql).toContain('CREATE TABLE "CollegeMaster"');
    expect(sql).toContain('CREATE TABLE "ActiveMatchUnmatchRequest"');
    expect(sql).toContain(
      `CREATE TYPE "ConversationThreadStatus" AS ENUM ('OPEN', 'READ_ONLY', 'ARCHIVED');`,
    );
    expect(sql).toContain('ADD CONSTRAINT "UserProfile_grade_check"');
    expect(sql).toContain('ADD CONSTRAINT "SeasonParticipantProfile_birthYear_check"');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "MatchRequest_seasonId_pairMinParticipantId_pairMaxParticipantId_pending_key"',
    );
    expect(sql).toContain('CREATE UNIQUE INDEX "ActiveMatch_seasonId_pairKey_live_key"');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "ActiveMatchUnmatchRequest_activeMatchId_participantId_pending_key"',
    );
  });

  it('legacy updatedAt trigger 구성을 누락하지 않는다', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION set_current_timestamp()');
    expect(sql).toContain('CREATE TRIGGER set_user_updated_at');
    expect(sql).toContain('CREATE TRIGGER set_auth_session_updated_at');
    expect(sql).toContain('CREATE TRIGGER set_season_dormitory_operation_updated_at');
  });
});
