import type { PrismaService } from '../../platform/database/prisma.service.js';
import { ChatThreadContextResolver } from './chat-thread-context.resolver.js';

function objectContaining(shape: Record<string, unknown>): unknown {
  return expect.objectContaining(shape) as unknown;
}

function makeThread(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-06-03T00:00:00.000Z');
  return {
    id: 'thread-1',
    status: 'OPEN',
    closedAt: null,
    closedReason: null,
    members: [
      {
        participantId: 'participant-1',
        memberState: 'ACTIVE',
        lastVisibleAt: now,
        participant: {
          userId: 'user-1',
        },
      },
    ],
    ...overrides,
  };
}

describe('ChatThreadContextResolver', () => {
  const prisma = {
    conversationThread: {
      findFirst: jest.fn(),
    },
  };
  const resolver = new ChatThreadContextResolver(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.conversationThread.findFirst.mockResolvedValue(makeThread());
  });

  it('OPEN/READ_ONLY thread의 visible active member만 조회해 context로 매핑한다', async () => {
    await expect(
      resolver.resolveVisibleActiveMemberContext({ actorUserId: 'user-1', threadId: 'thread-1' }),
    ).resolves.toMatchObject({
      threadId: 'thread-1',
      actorUserId: 'user-1',
      actorParticipantId: 'participant-1',
      memberState: 'ACTIVE',
      threadStatus: 'OPEN',
    });

    expect(prisma.conversationThread.findFirst).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({
          id: 'thread-1',
          status: { in: ['OPEN', 'READ_ONLY'] },
          members: objectContaining({
            some: objectContaining({
              memberState: 'ACTIVE',
              participant: objectContaining({
                userId: 'user-1',
                hiddenByAdminAt: null,
                deactivatedAt: null,
                user: { deletedAt: null },
              }),
            }),
          }),
        }),
        select: objectContaining({
          members: objectContaining({
            where: { participant: { userId: 'user-1' } },
          }),
        }),
      }),
    );
  });

  it('READ_ONLY thread도 route context로 허용해 detail/read marker hardening 정책을 유지한다', async () => {
    const closedAt = new Date('2026-06-03T01:00:00.000Z');
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeThread({ status: 'READ_ONLY', closedAt, closedReason: 'ACTIVE_MATCH_CREATED' }),
    );

    await expect(
      resolver.resolveVisibleActiveMemberContext({ actorUserId: 'user-1', threadId: 'thread-1' }),
    ).resolves.toMatchObject({
      threadStatus: 'READ_ONLY',
      closedAt,
      closedReason: 'ACTIVE_MATCH_CREATED',
    });
  });

  it('query가 thread를 찾지 못하면 context를 만들지 않는다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(null);

    await expect(
      resolver.resolveVisibleActiveMemberContext({ actorUserId: 'user-1', threadId: 'thread-1' }),
    ).resolves.toBeNull();
  });

  it('조회 결과에 active actor member가 없으면 context를 만들지 않는다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(makeThread({ members: [] }));

    await expect(
      resolver.resolveVisibleActiveMemberContext({ actorUserId: 'user-1', threadId: 'thread-1' }),
    ).resolves.toBeNull();
  });
});
