import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { notificationPayloadSchema } from '@repo/shared/notifications';
import {
  createReportRequestSchema,
  createReportResponseSchema,
  listReportsQuerySchema,
  reportListResponseSchema,
  reportReceiptSchema,
} from '@repo/shared/social-safety/report';

const serverTime = '2026-06-08T00:00:00.000Z';
const workspaceRoot = join(process.cwd(), '../..');
const sharedSourceRoot = join(workspaceRoot, 'packages/shared/src');
const webSourceRoot = join(workspaceRoot, 'apps/web/src');

const canonicalReportReasons = [
  'SEXUAL_HARASSMENT',
  'THREAT',
  'PERSONAL_INFO_EXPOSURE',
  'GENDER_IMPERSONATION',
  'FALSE_PROFILE',
  'SPAM_OR_AD',
  'HATE_OR_DISCRIMINATION',
  'OTHER',
] as const;

const legacyWebOnlyReportReasons = ['SPAM', 'FAKE_INFO', 'OFFENSIVE', 'SCAM'] as const;
const legacyWebReportReasonMembers = [...legacyWebOnlyReportReasons, 'OTHER'] as const;

function readOptional(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function containsStringLiteral(source: string, value: string) {
  return new RegExp(`["']${value}["']`).test(source);
}

describe('report shared contract', () => {
  it('defines the official 8 report reasons and no longer accepts legacy Web-only reasons', () => {
    const reportContractPath = join(sharedSourceRoot, 'social-safety/report.ts');
    const source = readOptional(reportContractPath);

    expect({
      exists: existsSync(reportContractPath),
      missingReasons: canonicalReportReasons.filter((reason) => !source.includes(reason)),
      legacyReasonsStillPresent: legacyWebOnlyReportReasons.filter((reason) =>
        containsStringLiteral(source, reason),
      ),
    }).toEqual({
      exists: true,
      missingReasons: [],
      legacyReasonsStillPresent: [],
    });
  });

  it('keeps the stale Web 5-reason type from remaining canonical', () => {
    const legacyWebSource = readOptional(join(webSourceRoot, 'types/report.ts'));

    expect(
      legacyWebReportReasonMembers.every((reason) =>
        containsStringLiteral(legacyWebSource, reason),
      ),
    ).toBe(false);
    expect(
      legacyWebOnlyReportReasons.filter((reason) => containsStringLiteral(legacyWebSource, reason)),
    ).toEqual([]);
    expect(
      legacyWebSource === '' || legacyWebSource.includes('@repo/shared/social-safety/report'),
    ).toBe(true);
  });

  it('report create contract stays intake-only and includes optional block result', () => {
    const reportContractPath = join(sharedSourceRoot, 'social-safety/report.ts');
    const source = readOptional(reportContractPath);

    expect(source).toContain('optionalAction');
    expect(source).toContain('optionalActionResult');
    expect(source).toContain("z.literal('RECEIVED')");
    expect(source).toContain('BLOCK_TARGET');
    expect(source).not.toContain("status: z.enum(['RECEIVED', 'UNDER_REVIEW', 'RESOLVED'])");
  });

  it('report request/response는 intake-only receipt와 optional block result를 고정한다', () => {
    expect(
      createReportRequestSchema.parse({
        targetType: 'PROFILE',
        targetId: 'target-user-1',
        reason: 'SEXUAL_HARASSMENT',
        detail: null,
        optionalAction: 'BLOCK_TARGET',
        falseReportDisclaimerAccepted: true,
      }),
    ).toMatchObject({ reason: 'SEXUAL_HARASSMENT', optionalAction: 'BLOCK_TARGET' });

    expect(
      createReportResponseSchema.parse({
        report: {
          id: 'report-1',
          targetType: 'PROFILE',
          reason: 'FALSE_PROFILE',
          receivedAt: serverTime,
          status: 'RECEIVED',
        },
        received: true,
        optionalActionResult: {
          action: 'BLOCK_TARGET',
          status: 'FAILED',
          code: 'ACTIVE_MATCH_BLOCK_NOT_ALLOWED',
        },
      }),
    ).toMatchObject({ report: { status: 'RECEIVED' }, received: true });

    expect(() =>
      reportReceiptSchema.parse({
        id: 'report-1',
        targetType: 'PROFILE',
        reason: 'FALSE_PROFILE',
        receivedAt: serverTime,
        status: 'UNDER_REVIEW',
      }),
    ).toThrow();

    expect(() =>
      createReportRequestSchema.parse({
        targetType: 'PROFILE',
        targetId: 'target-user-1',
        reason: 'SPAM',
        falseReportDisclaimerAccepted: true,
      }),
    ).toThrow();
  });

  it('report list contract는 신고자 본인용 접수 내역만 노출하고 운영 판단 필드를 거부한다', () => {
    expect(listReportsQuerySchema.parse({ limit: '10' })).toMatchObject({ limit: 10 });

    expect(
      reportListResponseSchema.parse({
        items: [
          {
            id: 'report-1',
            targetType: 'PROFILE',
            targetLabel: '지우님',
            reason: 'FALSE_PROFILE',
            receivedAt: serverTime,
            status: 'RECEIVED',
          },
        ],
        pageInfo: { hasNextPage: false, nextCursor: null },
      }),
    ).toMatchObject({ items: [{ targetLabel: '지우님', status: 'RECEIVED' }] });

    expect(() =>
      reportListResponseSchema.parse({
        items: [
          {
            id: 'report-1',
            targetType: 'PROFILE',
            targetLabel: '지우님',
            reason: 'FALSE_PROFILE',
            receivedAt: serverTime,
            status: 'RECEIVED',
            riskTier: 'HIGH',
          },
        ],
        pageInfo: { hasNextPage: false, nextCursor: null },
      }),
    ).toThrow();
  });

  it('report notification payload는 pointer만 허용한다', () => {
    expect(
      notificationPayloadSchema.parse({
        kind: 'REPORT_RECEIVED',
        reportId: 'report-1',
        status: 'RECEIVED',
        occurredAt: serverTime,
      }),
    ).toMatchObject({ kind: 'REPORT_RECEIVED', reportId: 'report-1' });

    expect(() =>
      notificationPayloadSchema.parse({
        kind: 'REPORT_RECEIVED',
        reportId: 'report-1',
        status: 'RECEIVED',
        occurredAt: serverTime,
        reportDetail: 'raw report detail',
      }),
    ).toThrow();
  });
});
