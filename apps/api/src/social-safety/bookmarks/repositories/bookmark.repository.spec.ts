import { describe, expect, it, vi } from 'vitest';
import { BookmarkRepository } from './bookmark.repository.js';

describe('BookmarkRepository', () => {
  it('ended season active bookmarks are expired through ordered bounded batches', async () => {
    const now = new Date('2026-06-08T00:00:00.000Z');
    const findMany = vi.fn().mockResolvedValue([{ id: 'bookmark-1' }, { id: 'bookmark-2' }]);
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const repository = new BookmarkRepository({ userBookmark: { findMany, updateMany } } as never);

    await expect(repository.expireActiveForEndedSeasons({ now, batchSize: 100 })).resolves.toEqual({
      scannedCount: 2,
      expiredCount: 2,
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        expiredAt: null,
        season: {
          seasonEndDate: { lt: now },
        },
      },
      select: { id: true },
      orderBy: [{ bookmarkedAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['bookmark-1', 'bookmark-2'] },
        deletedAt: null,
        expiredAt: null,
      },
      data: { expiredAt: now },
    });
  });

  it('does not issue update when no ended-season active bookmarks exist', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const updateMany = vi.fn();
    const repository = new BookmarkRepository({ userBookmark: { findMany, updateMany } } as never);

    await expect(
      repository.expireActiveForEndedSeasons({
        now: new Date('2026-06-08T00:00:00.000Z'),
        batchSize: 100,
      }),
    ).resolves.toEqual({ scannedCount: 0, expiredCount: 0 });

    expect(updateMany).not.toHaveBeenCalled();
  });
});
