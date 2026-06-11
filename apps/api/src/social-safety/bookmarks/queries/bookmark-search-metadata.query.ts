import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import type {
  BookmarkSearchMetadata,
  BookmarkSearchMetadataReaderPort,
} from '../application/ports/bookmark-search-metadata-reader.port.js';

@Injectable()
export class BookmarkSearchMetadataQuery implements BookmarkSearchMetadataReaderPort {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveBookmarkMetadata(input: {
    viewerUserId: string;
    seasonId: string;
    targetParticipantIds: readonly string[];
  }): Promise<ReadonlyMap<string, BookmarkSearchMetadata>> {
    const targetParticipantIds = [...new Set(input.targetParticipantIds)];
    if (targetParticipantIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.userBookmark.findMany({
      where: {
        viewerUserId: input.viewerUserId,
        seasonId: input.seasonId,
        targetParticipantId: { in: targetParticipantIds },
        deletedAt: null,
        expiredAt: null,
      },
      select: {
        targetParticipantId: true,
        bookmarkedAt: true,
      },
    });

    return new Map(
      rows.map((row) => [row.targetParticipantId, { bookmarkedAt: row.bookmarkedAt }]),
    );
  }
}
