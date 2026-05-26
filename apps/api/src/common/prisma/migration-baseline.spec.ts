import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_MIGRATION_PATH = path.resolve(
  CURRENT_DIR,
  '../../../prisma/migrations/000000000000_initial_baseline/migration.sql',
);

const REMOVED_PROFILE_ACCOUNT_ARTIFACTS = [
  'CREATE INDEX "User_dormitoryId_idx"',
  'ADD CONSTRAINT "User_dormitoryId_fkey"',
] as const;

const REMOVED_RETENTION_ARTIFACTS = [
  'RetainedIdentityRetentionReason',
  'ArchiveTier',
  'RETENTION_SNAPSHOT',
  'RETAINED_IDENTITY',
  'CREATE TABLE "RetainedIdentityDataAccessLog"',
  'CREATE TABLE "RetainedVaultAccessLog"',
  'CREATE TABLE "ConversationMessageRetainedBody"',
  'CREATE TABLE "ConversationMessageRetainedBodyAccessLog"',
] as const;

const REMOVED_UPDATED_AT_TRIGGER_ARTIFACTS = [
  'CREATE OR REPLACE FUNCTION set_current_timestamp()',
  'CREATE TRIGGER set_user_updated_at',
  'CREATE TRIGGER set_auth_session_updated_at',
  'CREATE TRIGGER set_season_dormitory_operation_updated_at',
] as const;

describe('migration baseline coverage', () => {
  const sql = readFileSync(BASELINE_MIGRATION_PATH, 'utf8');

  it('현재 baseline의 canonical enum/table/index/constraint와 제거된 schema artifact를 함께 고정한다', () => {
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    expect(sql).toContain(
      `CREATE TYPE "SeasonOverrideState" AS ENUM ('OFF_SEASON', 'SEASON_OPEN', 'SEASON_MATCHING', 'SEASON_POST_MATCH');`,
    );
    expect(sql).toContain(
      `CREATE TYPE "ProfileHistorySource" AS ENUM ('SEASON_REGISTRATION', 'SYSTEM_BACKFILL');`,
    );
    expect(sql).toContain(
      `CREATE TYPE "ArchiveJobTarget" AS ENUM ('SEASON_PROFILE_HISTORY', 'MATCH_HISTORY', 'THREAD_RETENTION', 'NICKNAME_AUDIT');`,
    );
    expect(sql).toContain(
      `CREATE TYPE "ParticipantHiddenReasonCode" AS ENUM ('POLICY_VIOLATION', 'SAFETY_REVIEW', 'ADMIN_REQUEST', 'OTHER');`,
    );
    expect(sql).toContain(
      `CREATE TYPE "MatchRequestTerminalReason" AS ENUM ('ACCEPTED', 'REJECTED_BY_RECEIVER', 'CANCELLED_BY_REQUESTER', 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH', 'EXPIRED', 'WITHDRAWN_PARTICIPANT', 'MATCH_PRECONDITION_FAILED', 'ADMIN_ACTION');`,
    );
    expect(sql).toContain('CREATE TABLE "CollegeMaster"');
    expect(sql).toContain('CREATE TABLE "UserDisplayIdentity"');
    expect(sql).toContain('CREATE TABLE "UserDismissedNotice"');
    expect(sql).toContain('CREATE TABLE "RetainedIdentity"');
    expect(sql).toContain('CREATE TABLE "RetainedIdentityHold"');
    expect(sql).toContain('CREATE TABLE "ArchiveJob"');
    expect(sql).toContain('CREATE TABLE "RetentionCase"');
    expect(sql).toContain('CREATE TABLE "RetainedVaultObject"');
    expect(sql).toContain('CREATE TABLE "RetainedVaultObjectHold"');
    expect(sql).toContain('CREATE TABLE "RetentionAccessLog"');
    expect(sql).toContain('CREATE TABLE "RetentionReviewJob"');
    expect(sql).toContain('CREATE TABLE "SeasonMatchHistoryEntryRetentionLink"');
    expect(sql).toContain(
      `CREATE TYPE "RetainedVaultObjectTarget" AS ENUM ('CHAT_MESSAGE_BODY', 'SEASON_PROFILE_HISTORY', 'MATCH_HISTORY_ENTRY', 'NICKNAME_AUDIT_EVENT');`,
    );
    expect(sql).toContain(
      `CREATE TYPE "RetentionCaseReason" AS ENUM ('ACCOUNT_DELETION', 'REPORT_REVIEW', 'ENFORCEMENT_RECORD', 'DISPUTE_RESPONSE', 'LEGAL_HOLD', 'ADMIN_MANUAL', 'CHAT_THREAD_ARCHIVE');`,
    );
    expect(sql).toContain(
      `CREATE TYPE "RetentionAccessTargetType" AS ENUM ('IDENTITY_ANCHOR', 'VAULT_OBJECT');`,
    );
    expect(sql).toContain(
      `CREATE TYPE "RetentionReviewJobTarget" AS ENUM ('CHAT_IDENTITY_LINK', 'ACCESS_LOG_DISPOSAL');`,
    );
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
    expect(sql).toContain('CREATE INDEX "RetainedIdentityHold_retentionCaseId_holdUntil_idx"');
    expect(sql).toContain('CREATE INDEX "RetentionAccessLog_retainedIdentityId_createdAt_idx"');
    expect(sql).toContain(
      'CREATE INDEX "RetentionAccessLog_logRetentionHoldUntil_logRetentionDispos_idx"',
    );
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "RetainedVaultObject_target_sourceId_subjectRole_key"',
    );
    expect(sql).toContain('CREATE INDEX "RetainedVaultObject_state_retainedAt_idx"');
    expect(sql).toContain(
      'CREATE INDEX "RetentionAccessLog_vaultTarget_accessReason_createdAt_idx"',
    );
    expect(sql).toContain('CREATE INDEX "ConversationMessage_bodyState_tombstonedAt_idx"');
    expect(sql).toContain('CREATE INDEX "ConversationMessage_retainedVaultObjectId_idx"');
    expect(sql).toContain('CREATE TABLE "UserDisplayIdentity"');
    expect(sql).toContain('CREATE TABLE "SeasonParticipantProfile"');
    expect(sql).toContain('CREATE TABLE "SeasonParticipantProfileHistory"');

    // These are not broad string-search guards. They pin removed DB-level artifacts
    // that would reintroduce old account-profile ownership or pre-RRPD retention tables.
    for (const artifact of [...REMOVED_PROFILE_ACCOUNT_ARTIFACTS, ...REMOVED_RETENTION_ARTIFACTS]) {
      expect(sql).not.toContain(artifact);
    }
  });

  it('updatedAt baseline은 legacy DB trigger가 아니라 Prisma @updatedAt 소유로 유지된다', () => {
    for (const artifact of REMOVED_UPDATED_AT_TRIGGER_ARTIFACTS) {
      expect(sql).not.toContain(artifact);
    }
  });
});
