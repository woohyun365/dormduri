import { describe, expect, it } from 'vitest';
import { HttpException } from '@nestjs/common';
import { decodeBookmarkListCursor, encodeBookmarkListCursor } from './bookmark-list.cursor.js';

const cursor = {
  sort: 'RECENT' as const,
  bookmarkedAt: '2026-06-08T00:00:00.000Z',
  id: 'bookmark-1',
};

describe('bookmark-list.cursor', () => {
  it('RECENT cursor를 deterministic하게 encode/decode한다', () => {
    expect(decodeBookmarkListCursor(encodeBookmarkListCursor(cursor), 'RECENT')).toEqual(cursor);
  });

  it('sort가 다른 cursor는 INVALID_BOOKMARK_QUERY로 거절한다', () => {
    expectInvalidBookmarkQuery(() =>
      decodeBookmarkListCursor(encodeBookmarkListCursor(cursor), 'MATCH_SCORE'),
    );
  });

  it('깨진 cursor는 INVALID_BOOKMARK_QUERY로 거절한다', () => {
    expectInvalidBookmarkQuery(() => decodeBookmarkListCursor('not-json', 'RECENT'));
  });
});

function expectInvalidBookmarkQuery(fn: () => unknown) {
  try {
    fn();
    throw new Error('expected invalid bookmark query');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'INVALID_BOOKMARK_QUERY',
      error: '북마크 목록 요청이 올바르지 않습니다.',
    });
  }
}
