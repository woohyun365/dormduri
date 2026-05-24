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
    expect(sql).toContain(
      `CREATE TYPE "ProfileHistorySource" AS ENUM ('SEASON_REGISTRATION', 'RETENTION_SNAPSHOT', 'SYSTEM_BACKFILL');`,
    );
    expect(sql).toContain(
      `CREATE TYPE "ArchiveJobTarget" AS ENUM ('RETAINED_IDENTITY', 'SEASON_PROFILE_HISTORY', 'MATCH_HISTORY', 'THREAD_RETENTION');`,
    );
    expect(sql).toContain(`CREATE TYPE "ArchiveTier" AS ENUM ('HOT_DB');`);
    expect(sql).toContain(
      `CREATE TYPE "ParticipantHiddenReasonCode" AS ENUM ('POLICY_VIOLATION', 'SAFETY_REVIEW', 'ADMIN_REQUEST', 'OTHER');`,
    );
    expect(sql).toContain('CREATE TABLE "CollegeMaster"');
    expect(sql).toContain('CREATE TABLE "UserDisplayIdentity"');
    expect(sql).toContain('CREATE TABLE "UserDismissedNotice"');
    expect(sql).toContain('CREATE TABLE "RetainedIdentity"');
    expect(sql).toContain('CREATE TABLE "RetainedIdentityDataAccessLog"');
    expect(sql).toContain('CREATE TABLE "ArchiveJob"');
    expect(sql).toContain('CREATE TABLE "ConversationMessageRetainedBody"');
    expect(sql).toContain('CREATE TABLE "ConversationMessageRetainedBodyAccessLog"');
    expect(sql).toContain('CREATE TABLE "SeasonParticipantProfileHistory"');
    expect(sql).toContain('CREATE TABLE "ActiveMatchUnmatchRequest"');
    expect(sql).toContain(
      `CREATE TYPE "ConversationThreadStatus" AS ENUM ('OPEN', 'READ_ONLY', 'ARCHIVED');`,
    );
    expect(sql).toContain(
      `CREATE TYPE "ArchiveJobStatus" AS ENUM ('PENDING', 'WAITING_CONDITION', 'SUCCEEDED', 'RETRY_SCHEDULED', 'FAILED_MANUAL_REVIEW');`,
    );
    expect(sql).toContain(
      `CREATE TYPE "ConversationMessageBodyState" AS ENUM ('PLAIN', 'TOMBSTONED', 'DISPOSED');`,
    );
    expect(sql).toContain('"registeredAtSnapshot" TIMESTAMPTZ(3)');
    expect(sql).toContain('ADD CONSTRAINT "SeasonParticipantProfile_birthYear_check"');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "MatchRequest_seasonId_pairMinParticipantId_pairMaxParticipantId_pending_key"',
    );
    expect(sql).toContain('CREATE UNIQUE INDEX "ActiveMatch_seasonId_pairKey_live_key"');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "ActiveMatchUnmatchRequest_activeMatchId_participantId_pending_key"',
    );
    expect(sql).toContain(
      'CREATE INDEX "RetainedIdentity_retentionHoldUntil_retentionDisposedAt_idx"',
    );
    expect(sql).toContain('CREATE INDEX "RetainedIdentityDataAccessLog_identity_createdAt_idx"');
    expect(sql).toContain('CREATE INDEX "RetainedIdentityDataAccessLog_logRetention_idx"');
    expect(sql).toContain('CREATE UNIQUE INDEX "ConversationMessageRetainedBody_messageId_key"');
    expect(sql).toContain('CREATE INDEX "ConversationMessage_bodyState_tombstonedAt_idx"');
    expect(sql).toContain('CREATE TABLE "UserDisplayIdentity"');
    expect(sql).toContain('CREATE TABLE "SeasonParticipantProfile"');
    expect(sql).toContain('CREATE TABLE "SeasonParticipantProfileHistory"');
    expect(sql).not.toContain('CREATE INDEX "User_dormitoryId_idx"');
    expect(sql).not.toContain('ADD CONSTRAINT "User_dormitoryId_fkey"');
  });

  it('updatedAt baseline은 DB trigger 없이도 유지된다', () => {
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION set_current_timestamp()');
    expect(sql).not.toContain('CREATE TRIGGER set_user_updated_at');
    expect(sql).not.toContain('CREATE TRIGGER set_auth_session_updated_at');
    expect(sql).not.toContain('CREATE TRIGGER set_season_dormitory_operation_updated_at');
  });
});
