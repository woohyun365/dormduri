import { describe, expect, it } from 'vitest';
import { notificationPayloadSchema } from '@repo/shared/notifications';
import {
  createReportRequestSchema,
  createReportResponseSchema,
  listReportsQuerySchema,
  reportListResponseSchema,
  reportReceiptSchema,
} from '@repo/shared/social-safety/report';

const serverTime = '2026-06-08T00:00:00.000Z';

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
describe('report shared contract', () => {
  it('공식 신고 사유만 허용한다', () => {
    for (const reason of canonicalReportReasons) {
      expect(
        createReportRequestSchema.safeParse({
          targetType: 'PROFILE',
          targetId: 'target-user-1',
          reason,
          falseReportDisclaimerAccepted: true,
        }).success,
      ).toBe(true);
    }

    for (const reason of legacyWebOnlyReportReasons) {
      expect(
        createReportRequestSchema.safeParse({
          targetType: 'PROFILE',
          targetId: 'target-user-1',
          reason,
          falseReportDisclaimerAccepted: true,
        }).success,
      ).toBe(false);
    }
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
