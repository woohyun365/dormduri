import { describe, expect, it } from 'vitest';

type ErrorWithResponse = { getResponse(): unknown };

function getErrorResponse(error: unknown): unknown {
  if (typeof error === 'object' && error !== null && 'getResponse' in error) {
    return (error as ErrorWithResponse).getResponse();
  }
  return null;
}
import {
  decodeGlobalNoticeListCursor,
  encodeGlobalNoticeListCursor,
} from './global-notice-list.cursor.js';

const publishedAt = new Date('2026-07-03T00:00:00.000Z');

describe('global notice list cursor', () => {
  it('publishedAt/id boundary를 opaque cursor로 round-trip한다', () => {
    const cursor = encodeGlobalNoticeListCursor({
      id: 'notice-1',
      title: '제목',
      summary: '요약',
      body: '본문',
      severity: 'INFO',
      relatedSeasonId: null,
      publishedAt,
      expiresAt: null,
      createdAt: publishedAt,
      updatedAt: publishedAt,
    });

    expect(decodeGlobalNoticeListCursor(cursor)).toEqual({
      publishedAt,
      noticeId: 'notice-1',
    });
  });

  it('손상된 cursor는 safe bad request error로 거절한다', () => {
    try {
      decodeGlobalNoticeListCursor('not-json');
      throw new Error('Expected cursor decode to fail');
    } catch (error) {
      expect(getErrorResponse(error)).toMatchObject({
        code: 'GLOBAL_NOTICE_LIST_CURSOR_INVALID',
      });
    }
  });
});
