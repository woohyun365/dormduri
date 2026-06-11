import { Injectable } from '@nestjs/common';
import type { BookmarkListResponse, ListBookmarksQuery } from '@repo/shared/social-safety/bookmark';
import type { AuthenticatedUserContext } from '../../../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import {
  BookmarkPresenter,
  type VisibleBookmarkListItemView,
} from '../presenters/bookmark.presenter.js';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';
import { BookmarkTargetPolicyEvaluator } from '../policies/bookmark-target-policy.evaluator.js';
import { decodeBookmarkListCursor } from './bookmark-list.cursor.js';

const MATCH_SCORE_SCAN_LIMIT = 200;

@Injectable()
export class BookmarkListQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: BookmarkRepository,
    private readonly targetPolicyEvaluator: BookmarkTargetPolicyEvaluator,
    private readonly presenter: BookmarkPresenter,
  ) {}

  async execute(input: {
    authUser: AuthenticatedUserContext;
    query: ListBookmarksQuery;
  }): Promise<BookmarkListResponse> {
    const now = await this.prisma.getDatabaseNow();
    const viewerContext = await this.targetPolicyEvaluator.loadViewerContext(input.authUser, now);
    if (!viewerContext.currentSeasonId) {
      return this.presenter.toListResponse({
        items: [],
        sort: input.query.sort,
        activeBookmarkCount: 0,
        hasNextPage: false,
        now,
      });
    }

    const activeBookmarkCount = await this.repository.countActiveForViewer({
      viewerUserId: input.authUser.id,
      seasonId: viewerContext.currentSeasonId,
    });
    if (activeBookmarkCount === 0) {
      return this.presenter.toListResponse({
        items: [],
        sort: input.query.sort,
        activeBookmarkCount,
        hasNextPage: false,
        now,
      });
    }

    const cursor = decodeBookmarkListCursor(input.query.cursor, input.query.sort);
    const rows = await this.repository.findActiveForViewer({
      viewerUserId: input.authUser.id,
      seasonId: viewerContext.currentSeasonId,
      limit: resolveScanLimit(input.query),
      cursor:
        cursor?.sort === 'RECENT'
          ? { bookmarkedAt: new Date(cursor.bookmarkedAt), id: cursor.id }
          : null,
    });
    const visibleItems = await this.toVisibleItems({ viewerContext, rows });
    const sortedItems = sortVisibleItems(visibleItems, input.query.sort);
    const cursorFilteredItems = filterByMatchScoreCursor(sortedItems, cursor);
    const pageItems = cursorFilteredItems.slice(0, input.query.limit);
    const hasNextPage = cursorFilteredItems.length > input.query.limit;

    return this.presenter.toListResponse({
      items: pageItems,
      sort: input.query.sort,
      activeBookmarkCount,
      hasNextPage,
      now,
    });
  }

  private async toVisibleItems(input: {
    viewerContext: Awaited<ReturnType<BookmarkTargetPolicyEvaluator['loadViewerContext']>>;
    rows: Awaited<ReturnType<BookmarkRepository['findActiveForViewer']>>;
  }): Promise<VisibleBookmarkListItemView[]> {
    const items = await Promise.all(
      input.rows.map(async (bookmark) => {
        const target = await this.targetPolicyEvaluator.resolveVisibleListItem({
          viewerContext: input.viewerContext,
          bookmark,
        });
        if (!target) {
          return null;
        }

        return {
          id: bookmark.id,
          targetUserId: bookmark.targetUserId,
          targetParticipantId: bookmark.targetParticipantId,
          bookmarkedAt: bookmark.bookmarkedAt,
          profileSummary: target.profileSummary,
          ...(typeof target.matchScore === 'number' ? { matchScore: target.matchScore } : {}),
        } satisfies VisibleBookmarkListItemView;
      }),
    );

    return items.filter((item): item is VisibleBookmarkListItemView => item !== null);
  }
}

function resolveScanLimit(query: ListBookmarksQuery) {
  if (query.sort === 'MATCH_SCORE') {
    return MATCH_SCORE_SCAN_LIMIT;
  }

  return query.limit + 1;
}

function sortVisibleItems(items: VisibleBookmarkListItemView[], sort: ListBookmarksQuery['sort']) {
  if (sort === 'MATCH_SCORE') {
    return [...items].sort((left, right) => {
      const scoreDiff = (right.matchScore ?? -1) - (left.matchScore ?? -1);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      const timeDiff = right.bookmarkedAt.getTime() - left.bookmarkedAt.getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return right.id.localeCompare(left.id);
    });
  }

  return items;
}

function filterByMatchScoreCursor(
  items: VisibleBookmarkListItemView[],
  cursor: ReturnType<typeof decodeBookmarkListCursor>,
) {
  if (cursor?.sort !== 'MATCH_SCORE') {
    return items;
  }

  return items.filter((item) => {
    const itemScore = item.matchScore ?? -1;
    const cursorScore = cursor.matchScore ?? -1;
    if (itemScore !== cursorScore) {
      return itemScore < cursorScore;
    }
    if (item.bookmarkedAt.toISOString() !== cursor.bookmarkedAt) {
      return item.bookmarkedAt.toISOString() < cursor.bookmarkedAt;
    }
    return item.id < cursor.id;
  });
}
