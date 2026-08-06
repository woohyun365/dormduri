import { describe, expect, it } from 'vitest';
import {
  bookmarkListResponseSchema,
  createBookmarkRequestSchema,
  listBookmarksQuerySchema,
  NO_BOOKMARKS,
  NO_VISIBLE_BOOKMARKS,
} from '@repo/shared/social-safety/bookmark';

const serverTime = '2026-06-08T00:00:00.000Z';

describe('bookmark shared contract', () => {
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
});
