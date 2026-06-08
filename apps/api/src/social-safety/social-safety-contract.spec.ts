import {
  bookmarkListResponseSchema,
  createBookmarkRequestSchema,
  listBookmarksQuerySchema,
  NO_BOOKMARKS,
  NO_VISIBLE_BOOKMARKS,
} from '@repo/shared/social-safety/bookmark';
import {
  BLOCK_NOTE_MAX_LENGTH,
  blockListResponseSchema,
  createBlockRequestSchema,
  listBlocksQuerySchema,
  NO_BLOCKS,
} from '@repo/shared/social-safety/block';
import {
  createReportRequestSchema,
  createReportResponseSchema,
  reportReceiptSchema,
} from '@repo/shared/social-safety/report';
import { notificationPayloadSchema } from '@repo/shared/notification-contract';
import { createSupportTicketRequestSchema } from '@repo/shared/support-contract';

const serverTime = '2026-06-08T00:00:00.000Z';

describe('Phase 2 social-safety shared contract', () => {
  it('bookmark request/query는 invalid target/sort/page size/cursor를 거절한다', () => {
    expect(() => createBookmarkRequestSchema.parse({ targetUserId: '' })).toThrow();
    expect(() => listBookmarksQuerySchema.parse({ sort: 'POPULAR' })).toThrow();
    expect(() => listBookmarksQuerySchema.parse({ limit: 51 })).toThrow();
    expect(() => listBookmarksQuerySchema.parse({ cursor: '' })).toThrow();

    expect(listBookmarksQuerySchema.parse({})).toMatchObject({ sort: 'RECENT', limit: 20 });
    expect(listBookmarksQuerySchema.parse({ sort: 'MATCH_SCORE', limit: '10' })).toMatchObject({
      sort: 'MATCH_SCORE',
      limit: 10,
    });
  });

  it('bookmark list response는 pageInfo/emptyState/sort/serverTime과 privacy-safe item만 허용한다', () => {
    expect(
      bookmarkListResponseSchema.parse({
        items: [],
        pageInfo: { hasNextPage: false, nextCursor: null },
        emptyState: { code: NO_BOOKMARKS },
        sort: 'RECENT',
        serverTime,
      }),
    ).toMatchObject({ emptyState: { code: NO_BOOKMARKS } });

    expect(
      bookmarkListResponseSchema.parse({
        items: [],
        pageInfo: { hasNextPage: false, nextCursor: null },
        emptyState: { code: NO_VISIBLE_BOOKMARKS },
        sort: 'MATCH_SCORE',
        serverTime,
      }),
    ).toMatchObject({ emptyState: { code: NO_VISIBLE_BOOKMARKS } });

    expect(() =>
      bookmarkListResponseSchema.parse({
        items: [
          {
            id: 'bookmark-1',
            targetUserId: 'target-user-1',
            targetParticipantId: 'participant-1',
            bookmarkedAt: serverTime,
            visibility: 'VISIBLE',
            profileSummary: {
              nickname: '룸메',
              intro: '',
              smokingBehavior: null,
              sleepHabit: null,
              relationshipStyle: null,
            },
            hiddenReasonCode: 'SAFETY_REVIEW',
          },
        ],
        pageInfo: { hasNextPage: false, nextCursor: null },
        emptyState: null,
        sort: 'RECENT',
        serverTime,
      }),
    ).toThrow();
  });

  it('block request/query/list response는 note 길이와 probing-safe projection을 고정한다', () => {
    expect(createBlockRequestSchema.parse({ note: '  메모  ' })).toEqual({ note: '메모' });
    expect(() =>
      createBlockRequestSchema.parse({ note: 'x'.repeat(BLOCK_NOTE_MAX_LENGTH + 1) }),
    ).toThrow();
    expect(() => listBlocksQuerySchema.parse({ limit: 51 })).toThrow();
    expect(() => listBlocksQuerySchema.parse({ cursor: '' })).toThrow();

    expect(
      blockListResponseSchema.parse({
        items: [
          {
            id: 'block-1',
            blockedUserId: 'target-user-1',
            blockedAt: serverTime,
            note: '개인 메모',
            visibility: 'NO_LONGER_VISIBLE',
            displayName: null,
          },
        ],
        pageInfo: { hasNextPage: false, nextCursor: null },
        emptyState: null,
        serverTime,
      }),
    ).toMatchObject({ items: [{ visibility: 'NO_LONGER_VISIBLE' }] });

    expect(
      blockListResponseSchema.parse({
        items: [],
        pageInfo: { hasNextPage: false, nextCursor: null },
        emptyState: { code: NO_BLOCKS },
        serverTime,
      }),
    ).toMatchObject({ emptyState: { code: NO_BLOCKS } });

    expect(() =>
      blockListResponseSchema.parse({
        items: [
          {
            id: 'block-1',
            blockedUserId: 'target-user-1',
            blockedAt: serverTime,
            note: null,
            visibility: 'VISIBLE',
            displayName: '룸메',
            hiddenReasonCode: 'SAFETY_REVIEW',
          },
        ],
        pageInfo: { hasNextPage: false, nextCursor: null },
        emptyState: null,
        serverTime,
      }),
    ).toThrow();
  });

  it('report/support/notification contracts는 policy baseline enum과 pointer payload만 허용한다', () => {
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

    expect(
      createSupportTicketRequestSchema.parse({
        category: 'APPEAL',
        subject: '이의 신청',
        body: '검토 요청',
        appealCategory: 'REPORT_RESULT',
        emailReplyConsent: false,
      }),
    ).toMatchObject({ category: 'APPEAL', emailReplyConsent: false });

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
        kind: 'SUPPORT_TICKET_REPLIED',
        supportTicketId: 'support-1',
        status: 'RESOLVED',
        occurredAt: serverTime,
        supportBody: 'raw body',
      }),
    ).toThrow();
  });
});
