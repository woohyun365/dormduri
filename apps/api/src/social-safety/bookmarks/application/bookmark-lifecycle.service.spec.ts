import { describe, expect, it, vi } from 'vitest';
import {
  BOOKMARK_EXPIRATION_BATCH_SIZE,
  BookmarkLifecycleService,
} from './bookmark-lifecycle.service.js';

describe('BookmarkLifecycleService', () => {
  it('delegates season-end bookmark expiration to repository with bounded batch size', async () => {
    const now = new Date('2026-06-08T00:00:00.000Z');
    const repository = {
      expireActiveForEndedSeasons: vi.fn().mockResolvedValue({ scannedCount: 3, expiredCount: 2 }),
    };
    const service = new BookmarkLifecycleService(repository as never);

    await expect(service.expireEndedSeasonBookmarks(now)).resolves.toEqual({
      scannedCount: 3,
      expiredCount: 2,
    });

    expect(repository.expireActiveForEndedSeasons).toHaveBeenCalledWith({
      now,
      batchSize: BOOKMARK_EXPIRATION_BATCH_SIZE,
    });
  });
});
