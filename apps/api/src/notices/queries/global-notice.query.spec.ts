import { describe, expect, it, vi } from 'vitest';

type ErrorWithResponse = { getResponse(): unknown };

function getErrorResponse(error: unknown): unknown {
  if (typeof error === 'object' && error !== null && 'getResponse' in error) {
    return (error as ErrorWithResponse).getResponse();
  }
  return null;
}
import { GlobalNoticeQuery } from './global-notice.query.js';

const now = new Date('2026-07-03T00:00:00.000Z');

function noticeRecord(id: string, publishedAt = now) {
  return {
    id,
    title: `공지 ${id}`,
    summary: `요약 ${id}`,
    body: `본문 ${id}`,
    severity: 'INFO',
    relatedSeasonId: null,
    publishedAt,
    expiresAt: null,
    createdAt: publishedAt,
    updatedAt: publishedAt,
  };
}

describe('GlobalNoticeQuery', () => {
  it('list는 limit+1 결과를 pageInfo cursor와 preview-only response로 변환한다', async () => {
    const repository = {
      listPublished: vi
        .fn()
        .mockResolvedValue([
          noticeRecord('notice-2', new Date('2026-07-03T00:00:02.000Z')),
          noticeRecord('notice-1', new Date('2026-07-03T00:00:01.000Z')),
        ]),
      findPublishedById: vi.fn(),
    };
    const query = new GlobalNoticeQuery(repository as never);

    const result = await query.list({ limit: 1 });

    expect(result.items).toEqual([
      expect.objectContaining({ id: 'notice-2', title: '공지 notice-2' }),
    ]);
    expect(result.items[0]).not.toHaveProperty('body');
    expect(result.pageInfo.hasNextPage).toBe(true);
    expect(typeof result.pageInfo.nextCursor).toBe('string');
    expect(repository.listPublished).toHaveBeenCalledWith({
      query: { limit: 1 },
      after: undefined,
    });
  });

  it('detail은 published record만 상세 body와 함께 반환하고 없으면 404를 반환한다', async () => {
    const repository = {
      listPublished: vi.fn(),
      findPublishedById: vi
        .fn()
        .mockResolvedValueOnce(noticeRecord('notice-1'))
        .mockResolvedValueOnce(null),
    };
    const query = new GlobalNoticeQuery(repository as never);

    await expect(query.get('notice-1')).resolves.toEqual({
      notice: {
        id: 'notice-1',
        title: '공지 notice-1',
        summary: '요약 notice-1',
        body: '본문 notice-1',
        severity: 'INFO',
        relatedSeasonId: null,
        publishedAt: now.toISOString(),
        expiresAt: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
    try {
      await query.get('missing');
      throw new Error('Expected missing notice to fail');
    } catch (error) {
      expect(getErrorResponse(error)).toMatchObject({ code: 'GLOBAL_NOTICE_NOT_FOUND' });
    }
  });
});
