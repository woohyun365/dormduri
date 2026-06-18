import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookmarkPresenter } from '../presenters/bookmark.presenter.js';
import { BookmarkListQuery } from './bookmark-list.query.js';

const now = new Date('2026-06-08T00:00:00.000Z');
const authUser = { id: 'viewer-user', campus: 'CHUNCHEON', gender: 'M' } as never;

function bookmarkRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bookmark-1',
    viewerUserId: 'viewer-user',
    seasonId: 'season-1',
    targetUserId: 'target-user',
    targetParticipantId: 'target-participant',
    bookmarkedAt: now,
    deletedAt: null,
    expiredAt: null,
    createdAt: now,
    updatedAt: now,
    targetUser: { id: 'target-user', deletedAt: null },
    targetParticipant: { id: 'target-participant' },
    ...overrides,
  } as never;
}

describe('BookmarkListQuery', () => {
  const prisma = { getDatabaseNow: vi.fn() };
  const repository = {
    countActiveForViewer: vi.fn(),
    findActiveForViewer: vi.fn(),
  };
  const targetPolicyEvaluator = {
    loadViewerContext: vi.fn(),
    resolveVisibleListItem: vi.fn(),
  };

  function query() {
    return new BookmarkListQuery(
      prisma as never,
      repository as never,
      targetPolicyEvaluator as never,
      new BookmarkPresenter(),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(now);
    targetPolicyEvaluator.loadViewerContext.mockResolvedValue({ currentSeasonId: 'season-1' });
    repository.countActiveForViewer.mockResolvedValue(1);
    repository.findActiveForViewer.mockResolvedValue([bookmarkRow()]);
  });

  it('active bookmark가 있어도 target이 hidden/deactivated/deleted 등으로 no longer visible이면 NO_VISIBLE_BOOKMARKS를 반환한다', async () => {
    targetPolicyEvaluator.resolveVisibleListItem.mockResolvedValue(null);

    await expect(
      query().execute({ authUser, query: { sort: 'RECENT', limit: 20, cursor: null } }),
    ).resolves.toMatchObject({
      items: [],
      emptyState: { code: 'NO_VISIBLE_BOOKMARKS' },
      pageInfo: { hasNextPage: false, nextCursor: null },
    });

    expect(targetPolicyEvaluator.resolveVisibleListItem).toHaveBeenCalledWith({
      viewerContext: { currentSeasonId: 'season-1' },
      bookmark: bookmarkRow(),
    });
  });

  it('active bookmark 자체가 없으면 target visibility evaluation 없이 NO_BOOKMARKS를 반환한다', async () => {
    repository.countActiveForViewer.mockResolvedValue(0);

    await expect(
      query().execute({ authUser, query: { sort: 'RECENT', limit: 20, cursor: null } }),
    ).resolves.toMatchObject({
      items: [],
      emptyState: { code: 'NO_BOOKMARKS' },
    });

    expect(repository.findActiveForViewer).not.toHaveBeenCalled();
    expect(targetPolicyEvaluator.resolveVisibleListItem).not.toHaveBeenCalled();
  });
});
