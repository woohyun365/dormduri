import { NO_BOOKMARKS, NO_VISIBLE_BOOKMARKS } from '@repo/shared/social-safety/bookmark';
import { BookmarkPresenter } from './bookmark.presenter.js';

const now = new Date('2026-06-08T00:00:00.000Z');
const bookmarkedAt = new Date('2026-06-07T00:00:00.000Z');

describe('BookmarkPresenter', () => {
  const presenter = new BookmarkPresenter();

  it('active row도 visible item도 없으면 NO_BOOKMARKS를 반환한다', () => {
    expect(
      presenter.toListResponse({
        items: [],
        sort: 'RECENT',
        activeBookmarkCount: 0,
        hasNextPage: false,
        now,
      }).emptyState,
    ).toEqual({ code: NO_BOOKMARKS });
  });

  it('active row는 있지만 visible item이 없으면 NO_VISIBLE_BOOKMARKS를 반환한다', () => {
    expect(
      presenter.toListResponse({
        items: [],
        sort: 'RECENT',
        activeBookmarkCount: 2,
        hasNextPage: false,
        now,
      }).emptyState,
    ).toEqual({ code: NO_VISIBLE_BOOKMARKS });
  });

  it('visible item은 privacy-safe allowlist와 cursor만 반환한다', () => {
    const response = presenter.toListResponse({
      items: [
        {
          id: 'bookmark-1',
          targetUserId: 'target-user-1',
          targetParticipantId: 'participant-1',
          bookmarkedAt,
          profileSummary: {
            nickname: '룸메',
            intro: '안녕하세요',
            smokingBehavior: 'NO',
            sleepHabit: 'NONE',
            relationshipStyle: 'QUIET',
          },
          matchScore: 87,
        },
      ],
      sort: 'MATCH_SCORE',
      activeBookmarkCount: 1,
      hasNextPage: true,
      now,
    });

    expect(response.items[0]).toEqual({
      id: 'bookmark-1',
      targetUserId: 'target-user-1',
      targetParticipantId: 'participant-1',
      bookmarkedAt: bookmarkedAt.toISOString(),
      visibility: 'VISIBLE',
      profileSummary: {
        nickname: '룸메',
        intro: '안녕하세요',
        smokingBehavior: 'NO',
        sleepHabit: 'NONE',
        relationshipStyle: 'QUIET',
      },
      matchScore: 87,
    });
    expect(JSON.stringify(response)).not.toContain('hiddenReasonCode');
    expect(response.pageInfo.nextCursor).toEqual(expect.any(String));
  });
});
