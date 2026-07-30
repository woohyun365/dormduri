import { describe, expect, it } from 'vitest';
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
      `CREATE TYPE "SeasonOperationAuditAction" AS ENUM ('UPDATE_SCHEDULE', 'UPDATE_OVERRIDE', 'CLEAR_OVERRIDE');`,
    );
    expect(sql).toContain(
      `CREATE TYPE "ProfileHistorySource" AS ENUM ('SEASON_REGISTRATION', 'SYSTEM_BACKFILL');`,
    );
    expect(sql).toContain(
      `CREATE TYPE "ArchiveJobTarget" AS ENUM ('SEASON_PROFILE_HISTORY', 'MATCH_HISTORY', 'THREAD_RETENTION', 'NICKNAME_AUDIT', 'ACADEMIC_IDENTITY_AUDIT');`,
    );
    expect(sql).toContain(
      `CREATE TYPE "ParticipantHiddenReasonCode" AS ENUM ('POLICY_VIOLATION', 'SAFETY_REVIEW', 'ADMIN_REQUEST', 'OTHER');`,
    );
    expect(sql).toContain(
      `CREATE TYPE "MatchRequestTerminalReason" AS ENUM ('ACCEPTED', 'REJECTED_BY_RECEIVER', 'CANCELLED_BY_REQUESTER', 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH', 'EXPIRED', 'WITHDRAWN_PARTICIPANT', 'MATCH_PRECONDITION_FAILED', 'ADMIN_ACTION');`,
    );
    expect(sql).toContain('CREATE TABLE "CollegeMaster"');
    expect(sql).toContain('CREATE TABLE "UserDisplayIdentity"');
    expect(sql).toContain('CREATE TABLE "UserAcademicIdentity"');
    expect(sql).toContain('CREATE TABLE "UserAcademicIdentityChangeAllowance"');
    expect(sql).toContain('CREATE TABLE "UserAcademicIdentityChangeEvent"');
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
      `CREATE TYPE "RetainedVaultObjectTarget" AS ENUM ('CHAT_MESSAGE_BODY', 'SEASON_PROFILE_HISTORY', 'MATCH_HISTORY_ENTRY', 'NICKNAME_AUDIT_EVENT', 'ACADEMIC_IDENTITY_AUDIT_EVENT');`,
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
    expect(sql).toContain('CREATE TABLE "UserAcademicIdentity"');
    expect(sql).toContain('CREATE TABLE "UserAcademicIdentityChangeEvent"');
    expect(sql).toContain('CREATE TABLE "SeasonParticipantProfile"');
    expect(sql).toContain('CREATE TABLE "SeasonParticipantProfileHistory"');
    expect(sql).toContain('CREATE TABLE "SeasonOperationAuditEvent"');
    expect(sql).toContain('"campusCode" "Campus" NOT NULL');
    expect(sql).toContain(
      'CREATE INDEX "SeasonOperationAuditEvent_seasonId_createdAt_idx" ON "SeasonOperationAuditEvent"("seasonId", "createdAt")',
    );
    expect(sql).toContain(
      'CREATE INDEX "SeasonOperationAuditEvent_campusCode_createdAt_idx" ON "SeasonOperationAuditEvent"("campusCode", "createdAt")',
    );
    expect(sql).toContain(
      'CREATE INDEX "SeasonOperationAuditEvent_action_createdAt_idx" ON "SeasonOperationAuditEvent"("action", "createdAt")',
    );
    expect(sql).toContain(
      'CREATE INDEX "SeasonOperationAuditEvent_actorUserId_createdAt_idx" ON "SeasonOperationAuditEvent"("actorUserId", "createdAt")',
    );
    expect(sql).toContain(
      'ALTER TABLE "SeasonOperationAuditEvent" ADD CONSTRAINT "SeasonOperationAuditEvent_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;',
    );

    // These are not broad string-search guards. They pin removed DB-level artifacts
    // that would reintroduce old account-profile ownership or pre-RRPD retention tables.
    for (const artifact of [...REMOVED_PROFILE_ACCOUNT_ARTIFACTS, ...REMOVED_RETENTION_ARTIFACTS]) {
      expect(sql).not.toContain(artifact);
    }
  });

  it('updatedAt baseline은 DB trigger가 아니라 Prisma @updatedAt 소유로 유지된다', () => {
    for (const artifact of REMOVED_UPDATED_AT_TRIGGER_ARTIFACTS) {
      expect(sql).not.toContain(artifact);
    }
  });

  it('auth session baseline은 opaque access token hash authority와 short access TTL column을 포함한다', () => {
    expect(sql).toContain('CREATE TABLE "AuthSession"');
    expect(sql).toContain('"sessionTokenHash" TEXT');
    expect(sql).toContain('"sessionTokenExpiresAt" TIMESTAMPTZ(3)');
    expect(sql).toContain('"previousRefreshTokenHash" TEXT');
    expect(sql).toContain('"previousRefreshTokenValidUntil" TIMESTAMPTZ(3)');
    expect(sql).toMatch(
      /ADD\s+CONSTRAINT\s+"AuthSession_previousRefreshToken_pair_check"\s+CHECK\s+\(\s*\("previousRefreshTokenHash" IS NULL AND "previousRefreshTokenValidUntil" IS NULL\)\s+OR\s+\("previousRefreshTokenHash" IS NOT NULL AND "previousRefreshTokenValidUntil" IS NOT NULL\)\s*\)/,
    );
    expect(sql).not.toContain('AuthSession_previousRefreshTokenHash_idx');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "AuthSession_sessionTokenHash_key" ON "AuthSession"("sessionTokenHash")',
    );
    expect(sql).toContain('CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId")');
    expect(sql).toContain(
      'CREATE INDEX "AuthSession_userId_revokedAt_expiresAt_idx" ON "AuthSession"("userId", "revokedAt", "expiresAt")',
    );
    expect(sql).toContain('CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt")');
    expect(sql).toContain(
      'CREATE INDEX "VerificationCode_codeExpiresAt_idx" ON "VerificationCode"("codeExpiresAt")',
    );
    expect(sql).toContain(
      'CREATE INDEX "VerificationCodeRequestLog_createdAt_idx" ON "VerificationCodeRequestLog"("createdAt")',
    );
    expect(sql).toContain(
      'CREATE INDEX "LoginAttempt_lastFailedAt_idx" ON "LoginAttempt"("lastFailedAt")',
    );
  });

  it('auth security event baseline은 민감값 대신 hash dimension과 운영 조회 index를 포함한다', () => {
    expect(sql).toContain('CREATE TYPE "AuthSecurityEventType"');
    expect(sql).toContain('CREATE TYPE "AuthSecurityEventSeverity"');
    expect(sql).toContain('CREATE TABLE "AuthSecurityEvent"');
    expect(sql).toContain('"emailHash" TEXT');
    expect(sql).toContain('"requestIpHash" TEXT');
    expect(sql).toContain('"userAgentHash" TEXT');
    expect(sql).toContain(
      'CREATE INDEX "AuthSecurityEvent_type_createdAt_idx" ON "AuthSecurityEvent"("type", "createdAt")',
    );
    expect(sql).toContain(
      'CREATE INDEX "AuthSecurityEvent_emailHash_type_createdAt_idx" ON "AuthSecurityEvent"("emailHash", "type", "createdAt")',
    );
    expect(sql).toContain(
      'CREATE INDEX "AuthSecurityEvent_createdAt_idx" ON "AuthSecurityEvent"("createdAt")',
    );
    expect(sql).not.toContain('"rawToken"');
    expect(sql).not.toContain('"rawCode"');
    expect(sql).not.toContain('"password" TEXT');
  });

  it('academic identity allowance는 retained payload가 아니라 User cascade live state로 유지된다', () => {
    expect(sql).toContain('CREATE TABLE "UserAcademicIdentityChangeAllowance"');
    expect(sql).toContain(
      'ALTER TABLE "UserAcademicIdentityChangeAllowance" ADD CONSTRAINT "UserAcademicIdentityChangeAllowance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;',
    );
    expect(sql).not.toContain('ACADEMIC_IDENTITY_CHANGE_ALLOWANCE');
    expect(sql).not.toContain('ACADEMIC_IDENTITY_ALLOWANCE');
  });

  it('chat realtime Phase 2 storage baseline은 idempotency/read marker/outbox/replay column과 index를 포함한다', () => {
    expect(sql).toContain('"clientMessageId" TEXT');
    expect(sql).toContain('"lastReadMessageId" TEXT');
    expect(sql).toContain('CREATE TABLE "ChatRealtimeOutboxEvent"');
    expect(sql).toContain('CREATE TABLE "ChatRealtimeEventRecipient"');
    expect(sql).toMatch(
      /ADD\s+CONSTRAINT\s+"ConversationMessage_body_length_check"\s+CHECK\s+\(char_length\("body"\) BETWEEN 1 AND 1000\)/,
    );
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "ConversationMessage_senderParticipantId_clientMessageId_key" ON "ConversationMessage"("senderParticipantId", "clientMessageId")',
    );
    expect(sql).toContain(
      'CREATE INDEX "ConversationMessage_threadId_sentAt_id_idx" ON "ConversationMessage"("threadId", "sentAt", "id")',
    );
    expect(sql).toContain(
      'CREATE INDEX "ConversationThreadMember_participantId_memberState_updatedAt_idx" ON "ConversationThreadMember"("participantId", "memberState", "updatedAt")',
    );
    expect(sql).toContain(
      'CREATE INDEX "ConversationThreadMember_participantId_memberState_threadId_idx" ON "ConversationThreadMember"("participantId", "memberState", "threadId")',
    );
    expect(sql).toContain(
      'CREATE INDEX "ChatRealtimeOutboxEvent_publishedAt_availableAt_occurredAt_id_idx" ON "ChatRealtimeOutboxEvent"("publishedAt", "availableAt", "occurredAt", "id")',
    );
    expect(sql).toContain(
      'CREATE INDEX "ChatRealtimeEventRecipient_userId_cursor_idx" ON "ChatRealtimeEventRecipient"("userId", "cursor")',
    );
    expect(sql).toContain(
      'ALTER TABLE "ChatRealtimeEventRecipient" ADD CONSTRAINT "ChatRealtimeEventRecipient_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ChatRealtimeOutboxEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;',
    );
    expect(sql).not.toContain('"outboxEventId"');
  });

  it('notification Phase 6-1.6 baseline은 read model/outbox table과 privacy-safe index를 포함한다', () => {
    expect(sql).toContain(
      "CREATE TYPE \"NotificationKind\" AS ENUM ('CHAT_THREAD_CREATED', 'REPORT_RECEIVED', 'REPORT_STATUS_UPDATED', 'PROFILE_MISMATCH_FEEDBACK', 'SEASON_SYSTEM_NOTICE', 'SUPPORT_TICKET_CREATED', 'SUPPORT_TICKET_REPLIED', 'SUPPORT_TICKET_ACTION_REQUIRED', 'SUPPORT_APPEAL_RESOLVED')",
    );
    expect(sql).toContain(
      "CREATE TYPE \"NotificationOutboxStatus\" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED')",
    );
    expect(sql).toContain('CREATE TABLE "UserNotification"');
    expect(sql).toContain('CREATE TABLE "NotificationOutboxEvent"');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "UserNotification_recipientUserId_kind_sourceType_sourceId_key" ON "UserNotification"("recipientUserId", "kind", "sourceType", "sourceId")',
    );
    expect(sql).toContain(
      'CREATE INDEX "UserNotification_recipientUserId_readAt_createdAt_id_idx" ON "UserNotification"("recipientUserId", "readAt", "createdAt", "id")',
    );
    expect(sql).toContain(
      'CREATE INDEX "NotificationOutboxEvent_status_availableAt_createdAt_id_idx" ON "NotificationOutboxEvent"("status", "availableAt", "createdAt", "id")',
    );
    expect(sql).toContain(
      'ALTER TABLE "NotificationOutboxEvent" ADD CONSTRAINT "NotificationOutboxEvent_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "UserNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;',
    );
  });

  it('legal document baseline은 공개 문서 version read model과 active lookup index를 포함한다', () => {
    expect(sql).toContain(
      `CREATE TYPE "LegalDocumentKind" AS ENUM ('TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'PERSONAL_DATA_COLLECTION_USE_CONSENT', 'AGE_14_OR_ABOVE_NOTICE');`,
    );
    expect(sql).toContain('CREATE TABLE "LegalDocumentVersion"');
    expect(sql).toContain('"kind" "LegalDocumentKind" NOT NULL');
    expect(sql).toContain('"summaryItems" JSONB NOT NULL');
    expect(sql).toContain('"sections" JSONB NOT NULL');
    expect(sql).toContain('"publishedAt" TIMESTAMPTZ(3)');
    expect(sql).toContain('"effectiveAt" TIMESTAMPTZ(3) NOT NULL');
    expect(sql).toContain('"retiredAt" TIMESTAMPTZ(3)');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "LegalDocumentVersion_kind_version_key" ON "LegalDocumentVersion"("kind", "version")',
    );
    expect(sql).toContain(
      'CREATE INDEX "LegalDocumentVersion_kind_publishedAt_effectiveAt_reti_idx" ON "LegalDocumentVersion"("kind", "publishedAt", "effectiveAt", "retiredAt")',
    );
    expect(sql).toContain(
      'CREATE INDEX "LegalDocumentVersion_kind_effectiveAt_id_idx" ON "LegalDocumentVersion"("kind", "effectiveAt", "id")',
    );
    expect(sql).toContain(`CREATE TYPE "LegalAcceptanceAction" AS ENUM ('AGREE', 'SHOW');`);
    expect(sql).toContain('CREATE TABLE "LegalAcceptanceRecord"');
    expect(sql).toContain('"documentVersionId" TEXT NOT NULL');
    expect(sql).toContain('"action" "LegalAcceptanceAction" NOT NULL');
    expect(sql).toContain('"source" TEXT NOT NULL DEFAULT \'SIGNUP\'');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "LegalAcceptanceRecord_userId_documentVersionId_key" ON "LegalAcceptanceRecord"("userId", "documentVersionId")',
    );
    expect(sql).toContain(
      'CREATE INDEX "LegalAcceptanceRecord_userId_kind_acceptedAt_idx" ON "LegalAcceptanceRecord"("userId", "kind", "acceptedAt")',
    );
    expect(sql).toContain(
      'CREATE INDEX "LegalAcceptanceRecord_kind_acceptedAt_idx" ON "LegalAcceptanceRecord"("kind", "acceptedAt")',
    );
    expect(sql).toContain(
      'ALTER TABLE "LegalAcceptanceRecord" ADD CONSTRAINT "LegalAcceptanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;',
    );
    expect(sql).toContain(
      'ALTER TABLE "LegalAcceptanceRecord" ADD CONSTRAINT "LegalAcceptanceRecord_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;',
    );
  });

  it('chat lifecycle event baseline은 audit/debug trace table과 minimal indexes를 포함하고 retention state model을 만들지 않는다', () => {
    expect(sql).toContain(
      `CREATE TYPE "ConversationThreadLifecycleEventType" AS ENUM ('THREAD_CREATED', 'THREAD_KIND_CHANGED', 'THREAD_READ_ONLY', 'THREAD_REOPENED', 'THREAD_ARCHIVED');`,
    );
    expect(sql).toContain(
      `CREATE TYPE "ConversationThreadLifecycleEventReason" AS ENUM ('DIRECT_MESSAGE_STARTED', 'MATCH_REQUEST_ACCEPTED', 'ACTIVE_MATCH_ENDED', 'ROOM_SELECTION_CUTOFF', 'SEASON_ENDED_SWEEP', 'PARTICIPANT_WITHDRAWN', 'USER_BLOCKED', 'BOTH_MEMBERS_LEFT', 'MODERATION_ACTION', 'ADMIN_ACTION');`,
    );
    expect(sql).toContain(
      `CREATE TYPE "ConversationThreadLifecycleActorType" AS ENUM ('USER', 'SYSTEM', 'ADMIN');`,
    );
    expect(sql).toContain(
      `CREATE TYPE "ConversationThreadLifecycleSourceDomain" AS ENUM ('CHAT', 'MATCHES', 'SEASON_PARTICIPANTS', 'SOCIAL_SAFETY', 'RETENTION', 'ADMIN');`,
    );
    expect(sql).toContain('CREATE TABLE "ConversationThreadLifecycleEvent"');
    expect(sql).toContain('"threadId" TEXT NOT NULL');
    expect(sql).toContain(
      'CREATE INDEX "CTLifecycleEvent_thread_occurred_id_idx" ON "ConversationThreadLifecycleEvent"("threadId", "occurredAt", "id")',
    );
    expect(sql).toContain(
      'CREATE INDEX "CTLifecycleEvent_type_occurred_id_idx" ON "ConversationThreadLifecycleEvent"("eventType", "occurredAt", "id")',
    );
    expect(sql).toContain(
      'CREATE INDEX "CTLifecycleEvent_actor_occurred_id_idx" ON "ConversationThreadLifecycleEvent"("actorUserId", "occurredAt", "id")',
    );
    expect(sql).toContain(
      'CREATE INDEX "CTLifecycleEvent_domain_occurred_id_idx" ON "ConversationThreadLifecycleEvent"("sourceDomain", "occurredAt", "id")',
    );
    expect(sql).toContain(
      'CREATE INDEX "CTLifecycleEvent_active_match_occurred_id_idx" ON "ConversationThreadLifecycleEvent"("sourceActiveMatchId", "occurredAt", "id")',
    );
    expect(sql).toContain(
      'CREATE INDEX "CTLifecycleEvent_match_request_occurred_id_idx" ON "ConversationThreadLifecycleEvent"("sourceMatchRequestId", "occurredAt", "id")',
    );
    expect(sql).toContain(
      'CREATE INDEX "CTLifecycleEvent_unmatch_request_occurred_id_idx" ON "ConversationThreadLifecycleEvent"("sourceUnmatchRequestId", "occurredAt", "id")',
    );
    expect(sql).toContain(
      'CREATE INDEX "CTLifecycleEvent_block_occurred_id_idx" ON "ConversationThreadLifecycleEvent"("sourceBlockId", "occurredAt", "id")',
    );
    expect(sql).toContain(
      'CREATE INDEX "CTLifecycleEvent_report_case_occurred_id_idx" ON "ConversationThreadLifecycleEvent"("sourceReportCaseId", "occurredAt", "id")',
    );
    expect(sql).toContain(
      'CREATE INDEX "CTLifecycleEvent_archive_job_occurred_id_idx" ON "ConversationThreadLifecycleEvent"("sourceArchiveJobId", "occurredAt", "id")',
    );
    expect(sql).toContain(
      'CREATE INDEX "CTLifecycleEvent_createdAt_idx" ON "ConversationThreadLifecycleEvent"("createdAt")',
    );
    expect(sql).toContain(
      'ALTER TABLE "ConversationThreadLifecycleEvent" ADD CONSTRAINT "ConversationThreadLifecycleEvent_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ConversationThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;',
    );
    expect(sql).not.toContain('ConversationThreadRetentionState');
  });

  it('match history baseline은 chat thread closure snapshot column을 포함하지 않는다', () => {
    expect(sql).toContain('CREATE TABLE "SeasonMatchHistoryEntry"');
    expect(sql).not.toContain('"threadClosedReason"');
    expect(sql).not.toContain('"threadClosedAt"');
    expect(sql).not.toContain('"hadConversation"');
  });
});
