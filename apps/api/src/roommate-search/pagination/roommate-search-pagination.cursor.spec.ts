import { describe, expect, it } from 'vitest';
import { createRoommateSearchPaginator } from './roommate-search-pagination.cursor.js';
import { createRoommateSearchTokenCodec } from './roommate-search-token.codec.js';

const now = new Date('2026-05-31T00:00:00.000Z');

function item(input: { id: string; nickname: string; matchScore?: number }) {
  return {
    id: input.id,
    cursorBoundary: {
      nicknameSortKey: input.nickname,
      participantId: input.id,
      ...(typeof input.matchScore === 'number' ? { matchScore: input.matchScore } : {}),
    },
  };
}

describe('roommate-search-pagination.cursor', () => {
  it('NICKNAME cursor는 nickname/participant boundary 이후 page를 반환한다', () => {
    const tokenCodec = createRoommateSearchTokenCodec();
    const paginator = createRoommateSearchPaginator(tokenCodec);
    const items = [
      item({ id: 'p-1', nickname: '가가' }),
      item({ id: 'p-2', nickname: '나나' }),
      item({ id: 'p-3', nickname: '다다' }),
    ];
    const queryDigest = tokenCodec.buildQueryDigest({
      scope: 'SAME_BUILDING_ONLY',
      sort: 'NICKNAME',
      query: { scope: 'SAME_BUILDING_ONLY', sort: 'NICKNAME', limit: 2 },
    });

    const first = paginator.paginate({
      items,
      query: { scope: 'SAME_BUILDING_ONLY', sort: 'NICKNAME', limit: 2 },
      viewerUserId: 'viewer',
      seasonId: 'season-1',
      scope: 'SAME_BUILDING_ONLY',
      appliedSort: 'NICKNAME',
      queryDigest,
      now,
    });
    expect(first.items.map((entry) => entry.id)).toEqual(['p-1', 'p-2']);
    expect(first.pageInfo.nextCursor).toEqual(expect.any(String));

    const second = paginator.paginate({
      items,
      query: {
        scope: 'SAME_BUILDING_ONLY',
        sort: 'NICKNAME',
        limit: 2,
        cursor: first.pageInfo.nextCursor ?? undefined,
      },
      viewerUserId: 'viewer',
      seasonId: 'season-1',
      scope: 'SAME_BUILDING_ONLY',
      appliedSort: 'NICKNAME',
      queryDigest,
      now,
    });
    expect(second.items.map((entry) => entry.id)).toEqual(['p-3']);
    expect(second.pageInfo).toEqual({ hasNextPage: false, nextCursor: null });
  });

  it('MATCH_SCORE cursor는 score desc 이후 nickname/participant boundary를 적용한다', () => {
    const tokenCodec = createRoommateSearchTokenCodec();
    const paginator = createRoommateSearchPaginator(tokenCodec);
    const items = [
      item({ id: 'p-1', nickname: '가가', matchScore: 95 }),
      item({ id: 'p-2', nickname: '나나', matchScore: 95 }),
      item({ id: 'p-3', nickname: '다다', matchScore: 90 }),
    ];
    const queryDigest = tokenCodec.buildQueryDigest({
      scope: 'SAME_BUILDING_ONLY',
      sort: 'MATCH_SCORE',
      query: { scope: 'SAME_BUILDING_ONLY', sort: 'MATCH_SCORE', limit: 2 },
    });

    const first = paginator.paginate({
      items,
      query: { scope: 'SAME_BUILDING_ONLY', sort: 'MATCH_SCORE', limit: 2 },
      viewerUserId: 'viewer',
      seasonId: 'season-1',
      scope: 'SAME_BUILDING_ONLY',
      appliedSort: 'MATCH_SCORE',
      queryDigest,
      now,
    });
    expect(first.items.map((entry) => entry.id)).toEqual(['p-1', 'p-2']);

    const second = paginator.paginate({
      items,
      query: {
        scope: 'SAME_BUILDING_ONLY',
        sort: 'MATCH_SCORE',
        limit: 2,
        cursor: first.pageInfo.nextCursor ?? undefined,
      },
      viewerUserId: 'viewer',
      seasonId: 'season-1',
      scope: 'SAME_BUILDING_ONLY',
      appliedSort: 'MATCH_SCORE',
      queryDigest,
      now,
    });
    expect(second.items.map((entry) => entry.id)).toEqual(['p-3']);
    expect(second.pageInfo).toEqual({ hasNextPage: false, nextCursor: null });
  });

  it('cursor queryDigest가 현재 query와 다르면 stale cursor로 거부한다', () => {
    const tokenCodec = createRoommateSearchTokenCodec();
    const paginator = createRoommateSearchPaginator(tokenCodec);
    const items = [item({ id: 'p-1', nickname: '가가' }), item({ id: 'p-2', nickname: '나나' })];
    const previousDigest = tokenCodec.buildQueryDigest({
      scope: 'SAME_BUILDING_ONLY',
      sort: 'NICKNAME',
      query: { scope: 'SAME_BUILDING_ONLY', sort: 'NICKNAME', limit: 1 },
    });
    const currentDigest = tokenCodec.buildQueryDigest({
      scope: 'SAME_BUILDING_ONLY',
      sort: 'NICKNAME',
      query: { scope: 'SAME_BUILDING_ONLY', sort: 'NICKNAME', smokingBehavior: 'NO', limit: 1 },
    });
    const cursor = tokenCodec.signCursor({
      viewerUserId: 'viewer',
      seasonId: 'season-1',
      scope: 'SAME_BUILDING_ONLY',
      sort: 'NICKNAME',
      queryDigest: previousDigest,
      after: items[0]!.cursorBoundary,
      now,
    });

    expect(() =>
      paginator.paginate({
        items,
        query: {
          scope: 'SAME_BUILDING_ONLY',
          sort: 'NICKNAME',
          smokingBehavior: 'NO',
          limit: 1,
          cursor,
        },
        viewerUserId: 'viewer',
        seasonId: 'season-1',
        scope: 'SAME_BUILDING_ONLY',
        appliedSort: 'NICKNAME',
        queryDigest: currentDigest,
        now,
      }),
    ).toThrow();
    try {
      paginator.paginate({
        items,
        query: {
          scope: 'SAME_BUILDING_ONLY',
          sort: 'NICKNAME',
          smokingBehavior: 'NO',
          limit: 1,
          cursor,
        },
        viewerUserId: 'viewer',
        seasonId: 'season-1',
        scope: 'SAME_BUILDING_ONLY',
        appliedSort: 'NICKNAME',
        queryDigest: currentDigest,
        now,
      });
    } catch (error) {
      expect(error).toMatchObject({
        response: { code: 'INVALID_ROOMMATE_SEARCH_QUERY' },
      });
    }
  });
});
