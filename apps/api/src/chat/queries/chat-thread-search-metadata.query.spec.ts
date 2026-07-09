import { describe, expect, it, vi } from 'vitest';
import { ChatThreadSearchMetadataQuery } from './chat-thread-search-metadata.query.js';

describe('ChatThreadSearchMetadataQuery', () => {
  it('OPEN thread를 target participant 기준 active chat metadata map에 담는다', async () => {
    const lastMessageAt = new Date('2026-07-08T03:00:00.000Z');
    const prisma = {
      $queryRawTyped: vi.fn().mockResolvedValue([
        {
          threadId: 'thread-direct',
          targetParticipantId: 'target-direct',
          threadKind: 'DIRECT',
          status: 'OPEN',
          lastMessageAt,
        },
        {
          threadId: 'thread-matched',
          targetParticipantId: 'target-matched',
          threadKind: 'MATCHED',
          status: 'OPEN',
          lastMessageAt: null,
        },
        {
          threadId: 'thread-read-only',
          targetParticipantId: 'target-read-only',
          threadKind: 'DIRECT',
          status: 'READ_ONLY',
          lastMessageAt,
        },
      ]),
    };
    const query = new ChatThreadSearchMetadataQuery(prisma as never);

    const result = await query.getActiveThreadMetadata({
      seasonId: 'season-1',
      viewerParticipantId: 'viewer-participant',
      targetParticipantIds: ['target-direct', 'target-matched', 'target-direct'],
    });

    expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(1);
    expect([...result.entries()]).toEqual([
      [
        'target-direct',
        {
          threadId: 'thread-direct',
          targetParticipantId: 'target-direct',
          threadKind: 'DIRECT',
          status: 'OPEN',
          lastMessageAt,
        },
      ],
      [
        'target-matched',
        {
          threadId: 'thread-matched',
          targetParticipantId: 'target-matched',
          threadKind: 'MATCHED',
          status: 'OPEN',
          lastMessageAt: null,
        },
      ],
    ]);
  });

  it('target이 없으면 SQL을 실행하지 않는다', async () => {
    const prisma = { $queryRawTyped: vi.fn() };
    const query = new ChatThreadSearchMetadataQuery(prisma as never);

    await expect(
      query.getActiveThreadMetadata({
        seasonId: 'season-1',
        viewerParticipantId: 'viewer-participant',
        targetParticipantIds: [],
      }),
    ).resolves.toEqual(new Map());
    expect(prisma.$queryRawTyped).not.toHaveBeenCalled();
  });
});
