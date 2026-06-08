import { Injectable } from '@nestjs/common';
import { BookmarkRepository } from '../repositories/bookmark.repository.js';

export interface BookmarkExpirationSweepResult {
  scannedCount: number;
  expiredCount: number;
}

export const BOOKMARK_EXPIRATION_BATCH_SIZE = 500;

@Injectable()
export class BookmarkLifecycleService {
  constructor(private readonly repository: BookmarkRepository) {}

  expireEndedSeasonBookmarks(now: Date): Promise<BookmarkExpirationSweepResult> {
    return this.repository.expireActiveForEndedSeasons({
      now,
      batchSize: BOOKMARK_EXPIRATION_BATCH_SIZE,
    });
  }
}
