import { ChatRealtimeReplayService } from './chat-realtime-replay.service.js';

describe('ChatRealtimeReplayService', () => {
  it('after cursor가 user recipient에 없으면 CURSOR_INVALID resync로 수렴한다', async () => {
    const service = new ChatRealtimeReplayService({ replayWindowDays: 7 });
    const prisma = {
      $queryRawTyped: jest.fn().mockResolvedValue([]),
    };

    await expect(
      service.getReplayEvents(prisma, {
        userId: 'user-1',
        after: 'missing-cursor',
        limit: 10,
        now: new Date('2026-02-10T03:00:00.000Z'),
      }),
    ).resolves.toEqual({
      status: 'resync_required',
      reason: 'CURSOR_INVALID',
    });
  });

  it('after cursor가 7일 replay window 밖이면 CURSOR_EXPIRED resync로 수렴한다', async () => {
    const service = new ChatRealtimeReplayService({ replayWindowDays: 7 });
    const prisma = {
      $queryRawTyped: jest.fn().mockResolvedValue([
        {
          cursor: 'cursor-expired',
          createdAt: new Date('2026-02-02T02:59:59.000Z'),
          eventId: 'event-expired',
        },
      ]),
    };

    await expect(
      service.getReplayEvents(prisma, {
        userId: 'user-1',
        after: 'cursor-expired',
        limit: 10,
        now: new Date('2026-02-09T03:00:00.000Z'),
      }),
    ).resolves.toEqual({
      status: 'resync_required',
      reason: 'CURSOR_EXPIRED',
    });
    expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(1);
  });

  it('payload privacy guard 위반 event는 replay 대신 resync required로 수렴한다', async () => {
    const service = new ChatRealtimeReplayService({ replayWindowDays: 7 });
    const prisma = {
      $queryRawTyped: jest.fn().mockResolvedValue([
        {
          eventId: 'event-unsafe',
          cursor: 'cursor-unsafe',
          eventType: 'chat.message.created',
          schemaVersion: 1,
          threadId: 'thread-1',
          payload: {
            message: {
              id: 'message-1',
              retainedVaultObjectId: 'vault-object-1',
            },
          },
          occurredAt: new Date('2026-02-10T03:00:00.000Z'),
          recipientCreatedAt: new Date('2026-02-10T03:00:00.000Z'),
        },
      ]),
    };

    await expect(
      service.getReplayEvents(prisma, {
        userId: 'user-1',
        after: null,
        limit: 10,
        now: new Date('2026-02-10T03:00:00.000Z'),
      }),
    ).resolves.toEqual({
      status: 'resync_required',
      reason: 'PRIVACY_GUARD',
    });
  });
});
