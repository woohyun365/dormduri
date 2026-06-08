import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { currentSeasonParticipantSelect } from '../../../season-participants/participants/season-participant-records.js';

export const bookmarkRecordSelect = {
  id: true,
  viewerUserId: true,
  seasonId: true,
  targetUserId: true,
  targetParticipantId: true,
  bookmarkedAt: true,
  deletedAt: true,
  expiredAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const bookmarkListRecordSelect = {
  ...bookmarkRecordSelect,
  targetUser: {
    select: {
      id: true,
      deletedAt: true,
    },
  },
  targetParticipant: {
    select: currentSeasonParticipantSelect,
  },
} as const;

export type BookmarkRecord = Prisma.UserBookmarkGetPayload<{
  select: typeof bookmarkRecordSelect;
}>;

export type BookmarkListRecord = Prisma.UserBookmarkGetPayload<{
  select: typeof bookmarkListRecordSelect;
}>;

export type BookmarkRepositoryClient = Pick<Prisma.TransactionClient, 'userBookmark'>;

@Injectable()
export class BookmarkRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveByParticipant(input: {
    client?: BookmarkRepositoryClient;
    viewerUserId: string;
    seasonId: string;
    targetParticipantId: string;
  }): Promise<BookmarkRecord | null> {
    const client = input.client ?? this.prisma;
    return client.userBookmark.findFirst({
      where: {
        viewerUserId: input.viewerUserId,
        seasonId: input.seasonId,
        targetParticipantId: input.targetParticipantId,
        deletedAt: null,
        expiredAt: null,
      },
      select: bookmarkRecordSelect,
    });
  }

  findRestorableByParticipant(input: {
    client?: BookmarkRepositoryClient;
    viewerUserId: string;
    seasonId: string;
    targetParticipantId: string;
  }): Promise<BookmarkRecord | null> {
    const client = input.client ?? this.prisma;
    return client.userBookmark.findFirst({
      where: {
        viewerUserId: input.viewerUserId,
        seasonId: input.seasonId,
        targetParticipantId: input.targetParticipantId,
        deletedAt: { not: null },
        expiredAt: null,
      },
      select: bookmarkRecordSelect,
      orderBy: [{ deletedAt: 'desc' }, { id: 'desc' }],
    });
  }

  create(input: {
    client: BookmarkRepositoryClient;
    viewerUserId: string;
    seasonId: string;
    targetUserId: string;
    targetParticipantId: string;
    now: Date;
  }): Promise<BookmarkRecord> {
    return input.client.userBookmark.create({
      data: {
        viewerUserId: input.viewerUserId,
        seasonId: input.seasonId,
        targetUserId: input.targetUserId,
        targetParticipantId: input.targetParticipantId,
        bookmarkedAt: input.now,
      },
      select: bookmarkRecordSelect,
    });
  }

  restore(input: {
    client: BookmarkRepositoryClient;
    bookmarkId: string;
    now: Date;
  }): Promise<BookmarkRecord> {
    return input.client.userBookmark.update({
      where: { id: input.bookmarkId },
      data: {
        deletedAt: null,
        bookmarkedAt: input.now,
      },
      select: bookmarkRecordSelect,
    });
  }

  async softDeleteActiveByTargetUser(input: {
    client: BookmarkRepositoryClient;
    viewerUserId: string;
    seasonId: string;
    targetUserId: string;
    now: Date;
  }): Promise<boolean> {
    const result = await input.client.userBookmark.updateMany({
      where: {
        viewerUserId: input.viewerUserId,
        seasonId: input.seasonId,
        targetUserId: input.targetUserId,
        deletedAt: null,
        expiredAt: null,
      },
      data: { deletedAt: input.now },
    });

    return result.count > 0;
  }

  async softDeleteActiveBetweenUsers(input: {
    client: BookmarkRepositoryClient;
    firstUserId: string;
    secondUserId: string;
    now: Date;
  }): Promise<number> {
    const result = await input.client.userBookmark.updateMany({
      where: {
        deletedAt: null,
        expiredAt: null,
        OR: [
          {
            viewerUserId: input.firstUserId,
            targetUserId: input.secondUserId,
          },
          {
            viewerUserId: input.secondUserId,
            targetUserId: input.firstUserId,
          },
        ],
      },
      data: { deletedAt: input.now },
    });

    return result.count;
  }

  countActiveForViewer(input: { viewerUserId: string; seasonId: string }): Promise<number> {
    return this.prisma.userBookmark.count({
      where: {
        viewerUserId: input.viewerUserId,
        seasonId: input.seasonId,
        deletedAt: null,
        expiredAt: null,
      },
    });
  }

  async expireActiveForEndedSeasons(input: {
    client?: BookmarkRepositoryClient;
    now: Date;
    batchSize: number;
  }): Promise<{ scannedCount: number; expiredCount: number }> {
    const client = input.client ?? this.prisma;
    const candidates = await client.userBookmark.findMany({
      where: {
        deletedAt: null,
        expiredAt: null,
        season: {
          seasonEndDate: { lt: input.now },
        },
      },
      select: { id: true },
      orderBy: [{ bookmarkedAt: 'asc' }, { id: 'asc' }],
      take: input.batchSize,
    });

    if (candidates.length === 0) {
      return { scannedCount: 0, expiredCount: 0 };
    }

    const result = await client.userBookmark.updateMany({
      where: {
        id: { in: candidates.map((bookmark) => bookmark.id) },
        deletedAt: null,
        expiredAt: null,
      },
      data: { expiredAt: input.now },
    });

    return {
      scannedCount: candidates.length,
      expiredCount: result.count,
    };
  }

  findActiveForViewer(input: {
    viewerUserId: string;
    seasonId: string;
    limit: number;
    cursor?: { bookmarkedAt: Date; id: string } | null;
  }): Promise<BookmarkListRecord[]> {
    return this.prisma.userBookmark.findMany({
      where: {
        viewerUserId: input.viewerUserId,
        seasonId: input.seasonId,
        deletedAt: null,
        expiredAt: null,
        ...(input.cursor
          ? {
              OR: [
                { bookmarkedAt: { lt: input.cursor.bookmarkedAt } },
                {
                  bookmarkedAt: input.cursor.bookmarkedAt,
                  id: { lt: input.cursor.id },
                },
              ],
            }
          : {}),
      },
      select: bookmarkListRecordSelect,
      orderBy: [{ bookmarkedAt: 'desc' }, { id: 'desc' }],
      take: input.limit,
    });
  }
}
