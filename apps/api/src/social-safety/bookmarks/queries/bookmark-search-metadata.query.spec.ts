import { describe, expect, it, vi } from 'vitest';
import { BookmarkSearchMetadataQuery } from './bookmark-search-metadata.query.js';

const now = new Date('2026-02-10T03:00:00.000Z');

describe('BookmarkSearchMetadataQuery', () => {
  it('visible search subset의 active bookmark metadata만 반환한다', async () => {
    const prisma = {
      userBookmark: {
        findMany: vi.fn().mockResolvedValue([
          { targetParticipantId: 'participant-a', bookmarkedAt: now },
          {
            targetParticipantId: 'participant-b',
            bookmarkedAt: new Date('2026-02-10T04:00:00.000Z'),
          },
        ]),
      },
    };
    const query = new BookmarkSearchMetadataQuery(prisma as never);

    const result = await query.getActiveBookmarkMetadata({
      viewerUserId: 'viewer-user',
      seasonId: 'season-1',
      targetParticipantIds: ['participant-a', 'participant-b', 'participant-a'],
    });

    expect(prisma.userBookmark.findMany).toHaveBeenCalledWith({
      where: {
        viewerUserId: 'viewer-user',
        seasonId: 'season-1',
        targetParticipantId: { in: ['participant-a', 'participant-b'] },
        deletedAt: null,
        expiredAt: null,
      },
      select: {
        targetParticipantId: true,
        bookmarkedAt: true,
      },
    });
    expect(result.get('participant-a')).toEqual({ bookmarkedAt: now });
    expect(result.get('participant-b')).toEqual({
      bookmarkedAt: new Date('2026-02-10T04:00:00.000Z'),
    });
  });

  it('target subset이 비어 있으면 DB를 조회하지 않는다', async () => {
    const prisma = {
      userBookmark: {
        findMany: vi.fn(),
      },
    };
    const query = new BookmarkSearchMetadataQuery(prisma as never);

    await expect(
      query.getActiveBookmarkMetadata({
        viewerUserId: 'viewer-user',
        seasonId: 'season-1',
        targetParticipantIds: [],
      }),
    ).resolves.toEqual(new Map());
    expect(prisma.userBookmark.findMany).not.toHaveBeenCalled();
  });
});
