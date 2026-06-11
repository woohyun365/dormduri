import type {
  RoommateSearchQuery,
  RoommateSearchResponse,
  RoommateSearchScope,
  RoommateSearchSort,
} from '@repo/shared/roommate-search/contract';
import { roommateSearchErrors } from '../errors/roommate-search.errors.js';
import {
  createRoommateSearchTokenCodec,
  type RoommateSearchCursorBoundary,
  type RoommateSearchTokenCodec,
} from './roommate-search-token.codec.js';

export interface RoommateSearchPaginationItem {
  cursorBoundary: RoommateSearchCursorBoundary;
}

export function createRoommateSearchPaginator(
  tokenCodec: RoommateSearchTokenCodec = createRoommateSearchTokenCodec(),
) {
  return {
    paginate<T extends RoommateSearchPaginationItem>(input: {
      items: T[];
      query: RoommateSearchQuery;
      viewerUserId: string;
      seasonId: string | null;
      scope: RoommateSearchScope;
      appliedSort: RoommateSearchSort;
      queryDigest: string;
      now: Date;
    }): { items: T[]; pageInfo: RoommateSearchResponse['pageInfo'] } {
      if (!input.seasonId) {
        return { items: [], pageInfo: { hasNextPage: false, nextCursor: null } };
      }

      const startIndex = input.query.cursor
        ? resolveCursorStartIndex(tokenCodec, {
            cursor: input.query.cursor,
            items: input.items,
            viewerUserId: input.viewerUserId,
            seasonId: input.seasonId,
            scope: input.scope,
            appliedSort: input.appliedSort,
            queryDigest: input.queryDigest,
            now: input.now,
          })
        : 0;
      const limit = input.query.limit ?? 20;
      const page = input.items.slice(startIndex, startIndex + limit);
      const hasNextPage = startIndex + limit < input.items.length;
      const lastItem = page.at(-1);
      const nextCursor =
        hasNextPage && lastItem
          ? tokenCodec.signCursor({
              viewerUserId: input.viewerUserId,
              seasonId: input.seasonId,
              scope: input.scope,
              sort: input.appliedSort,
              queryDigest: input.queryDigest,
              after: lastItem.cursorBoundary,
              now: input.now,
            })
          : null;

      return {
        items: page,
        pageInfo: {
          hasNextPage,
          nextCursor,
        },
      };
    },
  };
}

function resolveCursorStartIndex<T extends RoommateSearchPaginationItem>(
  tokenCodec: RoommateSearchTokenCodec,
  input: {
    cursor: string;
    items: T[];
    viewerUserId: string;
    seasonId: string;
    scope: RoommateSearchScope;
    appliedSort: RoommateSearchSort;
    queryDigest: string;
    now: Date;
  },
) {
  try {
    const verified = tokenCodec.verifyCursor({
      token: input.cursor,
      viewerUserId: input.viewerUserId,
      seasonId: input.seasonId,
      scope: input.scope,
      sort: input.appliedSort,
      queryDigest: input.queryDigest,
      now: input.now,
    });
    const firstIndexAfterBoundary = input.items.findIndex((item) =>
      isAfterBoundary(item.cursorBoundary, verified.boundary, input.appliedSort),
    );
    return firstIndexAfterBoundary === -1 ? input.items.length : firstIndexAfterBoundary;
  } catch {
    throw roommateSearchErrors.invalidQuery(
      '검색 cursor가 만료되었거나 현재 검색 조건과 일치하지 않습니다.',
    );
  }
}

export function isAfterBoundary(
  current: RoommateSearchCursorBoundary,
  boundary: RoommateSearchCursorBoundary,
  sort: RoommateSearchSort,
) {
  if (sort === 'MATCH_SCORE') {
    if (typeof current.matchScore !== 'number' || typeof boundary.matchScore !== 'number') {
      return false;
    }
    if (current.matchScore !== boundary.matchScore) {
      return current.matchScore < boundary.matchScore;
    }
  }

  if (current.nicknameSortKey !== boundary.nicknameSortKey) {
    return current.nicknameSortKey > boundary.nicknameSortKey;
  }

  return current.participantId > boundary.participantId;
}
