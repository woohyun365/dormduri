import type {
  BookmarkListItem,
  BookmarkListMetadata,
  BookmarkListResponse,
  BookmarkSort,
  CreateBookmarkResponse,
  DeleteBookmarkResponse,
} from '@repo/shared/social-safety/bookmark';
import { NO_BOOKMARKS, NO_VISIBLE_BOOKMARKS } from '@repo/shared/social-safety/bookmark';
import { Injectable } from '@nestjs/common';
import { encodeBookmarkListCursor } from '../queries/bookmark-list.cursor.js';

export interface BookmarkRecordView {
  id: string;
  targetUserId: string;
  targetParticipantId: string;
  bookmarkedAt: Date;
}

export interface VisibleBookmarkListItemView extends BookmarkRecordView {
  profileSummary: BookmarkListItem['profileSummary'];
  matchScore?: number;
}

@Injectable()
export class BookmarkPresenter {
  toCreateResponse(input: {
    bookmark: BookmarkRecordView;
    created: boolean;
    now: Date;
  }): CreateBookmarkResponse {
    return {
      bookmark: this.toBookmark(input.bookmark),
      created: input.created,
      listMetadata: this.toListMetadata('RECENT', input.now),
    };
  }

  toDeleteResponse(input: { deleted: boolean; now: Date }): DeleteBookmarkResponse {
    return {
      deleted: input.deleted,
      listMetadata: this.toListMetadata('RECENT', input.now),
    };
  }

  toListResponse(input: {
    items: VisibleBookmarkListItemView[];
    sort: BookmarkSort;
    activeBookmarkCount: number;
    hasNextPage: boolean;
    now: Date;
  }): BookmarkListResponse {
    return {
      items: input.items.map((item) => ({
        id: item.id,
        targetUserId: item.targetUserId,
        targetParticipantId: item.targetParticipantId,
        bookmarkedAt: item.bookmarkedAt.toISOString(),
        visibility: 'VISIBLE',
        profileSummary: item.profileSummary,
        ...(typeof item.matchScore === 'number' ? { matchScore: item.matchScore } : {}),
      })),
      pageInfo: {
        hasNextPage: input.hasNextPage,
        nextCursor: input.hasNextPage
          ? encodeBookmarkListCursor(toCursorPayload(input.sort, input.items.at(-1)))
          : null,
      },
      emptyState: resolveEmptyState(input.activeBookmarkCount, input.items.length),
      sort: input.sort,
      serverTime: input.now.toISOString(),
    };
  }

  private toBookmark(bookmark: BookmarkRecordView) {
    return {
      id: bookmark.id,
      targetUserId: bookmark.targetUserId,
      targetParticipantId: bookmark.targetParticipantId,
      bookmarkedAt: bookmark.bookmarkedAt.toISOString(),
    };
  }

  private toListMetadata(sort: BookmarkSort, now: Date): BookmarkListMetadata {
    return {
      sort,
      serverTime: now.toISOString(),
    };
  }
}

function resolveEmptyState(activeBookmarkCount: number, visibleItemCount: number) {
  if (visibleItemCount > 0) {
    return null;
  }

  return {
    code: activeBookmarkCount > 0 ? NO_VISIBLE_BOOKMARKS : NO_BOOKMARKS,
  };
}

function toCursorPayload(sort: BookmarkSort, item: VisibleBookmarkListItemView | undefined) {
  if (!item) {
    throw new Error('[BookmarkPresenter] next cursor requested without list item');
  }

  const base = {
    bookmarkedAt: item.bookmarkedAt.toISOString(),
    id: item.id,
  };

  if (sort === 'MATCH_SCORE') {
    return {
      sort,
      matchScore: item.matchScore ?? null,
      ...base,
    } as const;
  }

  return {
    sort,
    ...base,
  } as const;
}
