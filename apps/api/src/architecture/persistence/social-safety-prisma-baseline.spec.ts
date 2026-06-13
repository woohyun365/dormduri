import { describe, expect, it } from 'vitest';
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

describe('social-safety Prisma persistence baseline', () => {
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

  it('keeps UserBlock relation/event models and list indexes in Prisma schema', () => {
    const source = read(schemaPath);

    expect(source).toContain('enum UserBlockEventType');
    expect(source).toContain('model UserBlock');
    expect(source).toContain('blockerUserId');
    expect(source).toContain('blockedUserId');
    expect(source).toContain('unblockedAt');
    expect(source).toContain('model UserBlockEvent');
    expect(source).toContain('eventType    UserBlockEventType');
    expect(source).toContain('@@index([blockerUserId, unblockedAt, blockedAt, id])');
    expect(source).toContain('@@index([blockedUserId, unblockedAt, blockedAt, id])');
  });

  it('keeps active block dedupe and reverse lookup indexes in baseline SQL as partial indexes', () => {
    const source = read(baselineMigrationPath);

    expect(source).toContain('CREATE TABLE "UserBlock"');
    expect(source).toContain('CREATE TABLE "UserBlockEvent"');
    expect(source).toContain('UserBlock_blockerUserId_blockedUserId_active_key');
    expect(source).toContain('ON "UserBlock"("blockerUserId", "blockedUserId")');
    expect(source).toContain('WHERE "unblockedAt" IS NULL');
    expect(source).toContain('UserBlock_active_list_cursor_idx');
    expect(source).toContain('"blockedAt" DESC, "id" DESC');
    expect(source).toContain('UserBlock_active_reverse_lookup_idx');
  });

  it('keeps report intake models and event allowlist in Prisma schema', () => {
    const source = read(schemaPath);

    expect(source).toContain('enum ReportTargetType');
    expect(source).toContain('enum ReportReason');
    expect(source).toContain('enum ReportCaseEventType');
    expect(source).toContain('model ReportCase');
    expect(source).toContain('model ReportCaseEvent');
    expect(source).toContain('PROFILE_MISMATCH_FEEDBACK_CANDIDATE_RECORDED');
    expect(source).toContain('UNVERIFIED_ATTACHMENT_POINTERS_RECORDED');
    expect(source).toContain('@@index([targetType, targetId, status, receivedAt, id])');
  });

  it('keeps notification campaign and operator alert baseline models', () => {
    const schema = read(schemaPath);
    const migration = read(baselineMigrationPath);

    expect(schema).toContain('enum NotificationCampaignStatus');
    expect(schema).toContain('model NotificationCampaign');
    expect(schema).toContain('model OperatorAlert');
    expect(schema).toContain('OperatorAlertCategory');
    expect(schema).toContain('PROFILE_MISMATCH_FEEDBACK');
    expect(schema).toContain('SEASON_SYSTEM_NOTICE');
    expect(migration).toContain('CREATE TABLE "NotificationCampaign"');
    expect(migration).toContain('CREATE TABLE "OperatorAlert"');
    expect(migration).toContain('NotificationCampaign_kind_sourceType_sourceId_key');
    expect(migration).toContain('OperatorAlert_sourceType_sourceId_category_key');
    expect(migration).toContain('PROFILE_MISMATCH_FEEDBACK');
    expect(migration).toContain('SEASON_SYSTEM_NOTICE');
  });

  it('keeps report open dedupe and queue indexes in baseline SQL', () => {
    const source = read(baselineMigrationPath);

    expect(source).toContain('CREATE TABLE "ReportCase"');
    expect(source).toContain('CREATE TABLE "ReportCaseEvent"');
    expect(source).toContain('ReportCase_reporter_target_reason_open_key');
    expect(source).toContain("WHERE \"status\" IN ('SUBMITTED', 'EVIDENCE_ONLY')");
    expect(source).toContain('ReportCase_targetType_targetId_status_receivedAt_id_idx');
    expect(source).toContain('ReportCaseEvent_reportCaseId_occurredAt_id_idx');
  });

  it('keeps support ticket/FAQ models and indexes in Prisma baseline', () => {
    const schema = read(schemaPath);
    const migration = read(baselineMigrationPath);

    expect(schema).toContain('enum SupportTicketCategory');
    expect(schema).toContain('enum SupportTicketStatus');
    expect(schema).toContain('enum SupportMessageSenderType');
    expect(schema).toContain('enum SupportAppealCategory');
    expect(schema).toContain('model SupportTicket');
    expect(schema).toContain('model SupportTicketMessage');
    expect(schema).toContain('model SupportFaqArticle');
    expect(schema).toContain('@@index([requesterUserId, status, lastMessageAt, id])');
    expect(schema).toContain('@@index([published, category, sortOrder, id])');
    expect(migration).toContain('CREATE TABLE "SupportTicket"');
    expect(migration).toContain('CREATE TABLE "SupportTicketMessage"');
    expect(migration).toContain('CREATE TABLE "SupportFaqArticle"');
    expect(migration).toContain('SupportTicket_requesterUserId_status_lastMessageAt_id_idx');
    expect(migration).toContain('SupportFaqArticle_published_category_sortOrder_id_idx');
  });
});
