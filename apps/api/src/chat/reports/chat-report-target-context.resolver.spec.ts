import type { PrismaService } from '../../platform/database/prisma.service.js';
import { ChatReportTargetContextResolver } from './chat-report-target-context.resolver.js';

function objectContaining(shape: Record<string, unknown>): unknown {
  return expect.objectContaining(shape) as unknown;
}

const prisma = {
  conversationThread: {
    findFirst: jest.fn(),
  },
  conversationMessage: {
    findFirst: jest.fn(),
  },
};

function makeThread(overrides: Record<string, unknown> = {}) {
  return {
    id: 'thread-1',
    seasonId: 'season-1',
    participantAId: 'participant-actor',
    participantBId: 'participant-target',
    threadKind: 'DIRECT',
    status: 'OPEN',
    closedReason: null,
    participantA: { id: 'participant-actor', userId: 'user-actor' },
    participantB: { id: 'participant-target', userId: 'user-target' },
    ...overrides,
  };
}

function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'message-1',
    threadId: 'thread-1',
    senderParticipantId: 'participant-target',
    bodyState: 'PLAIN',
    tombstoneReason: null,
    thread: {
      seasonId: 'season-1',
      participantAId: 'participant-actor',
      participantBId: 'participant-target',
    },
    senderParticipant: { id: 'participant-target', userId: 'user-target' },
    ...overrides,
  };
}

describe('ChatReportTargetContextResolver', () => {
  const resolver = new ChatReportTargetContextResolver(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.conversationThread.findFirst.mockResolvedValue(makeThread());
    prisma.conversationMessage.findFirst.mockResolvedValue(makeMessage());
  });

  it('OPEN/READ_ONLY active member thread를 report target context로 매핑한다', async () => {
    await expect(
      resolver.resolveThreadTarget({
        actorParticipantId: 'participant-actor',
        seasonId: 'season-1',
        threadId: 'thread-1',
      }),
    ).resolves.toEqual({
      threadId: 'thread-1',
      seasonId: 'season-1',
      counterpartUserId: 'user-target',
      counterpartParticipantId: 'participant-target',
      participantAId: 'participant-actor',
      participantBId: 'participant-target',
      threadKind: 'DIRECT',
      status: 'OPEN',
      closedReason: null,
    });

    expect(prisma.conversationThread.findFirst).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({
          id: 'thread-1',
          seasonId: 'season-1',
          status: { in: ['OPEN', 'READ_ONLY'] },
          members: objectContaining({
            some: objectContaining({
              participantId: 'participant-actor',
              memberState: 'ACTIVE',
            }),
          }),
        }),
        select: objectContaining({
          id: true,
          seasonId: true,
          participantAId: true,
          participantBId: true,
          threadKind: true,
          status: true,
          closedReason: true,
        }),
      }),
    );
  });

  it('READ_ONLY thread도 reportable thread pointer로 허용한다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeThread({ status: 'READ_ONLY', closedReason: 'USER_BLOCKED' }),
    );

    await expect(
      resolver.resolveThreadTarget({
        actorParticipantId: 'participant-actor',
        seasonId: 'season-1',
        threadId: 'thread-1',
      }),
    ).resolves.toMatchObject({
      status: 'READ_ONLY',
      closedReason: 'USER_BLOCKED',
    });
  });

  it('thread가 없거나 actor가 thread participant가 아니면 null로 fail-closed한다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValueOnce(null);

    await expect(
      resolver.resolveThreadTarget({
        actorParticipantId: 'participant-actor',
        seasonId: 'season-1',
        threadId: 'thread-1',
      }),
    ).resolves.toBeNull();

    prisma.conversationThread.findFirst.mockResolvedValueOnce(
      makeThread({ participantAId: 'participant-other-a', participantBId: 'participant-other-b' }),
    );

    await expect(
      resolver.resolveThreadTarget({
        actorParticipantId: 'participant-actor',
        seasonId: 'season-1',
        threadId: 'thread-1',
      }),
    ).resolves.toBeNull();
  });

  it('non-deleted message와 visible active member thread를 report target context로 매핑한다', async () => {
    await expect(
      resolver.resolveMessageTarget({
        actorParticipantId: 'participant-actor',
        seasonId: 'season-1',
        messageId: 'message-1',
      }),
    ).resolves.toEqual({
      messageId: 'message-1',
      threadId: 'thread-1',
      seasonId: 'season-1',
      senderUserId: 'user-target',
      senderParticipantId: 'participant-target',
      participantAId: 'participant-actor',
      participantBId: 'participant-target',
      bodyState: 'PLAIN',
      tombstoneReason: null,
    });

    const messageFindFirst = prisma.conversationMessage.findFirst as jest.MockedFunction<
      (args: { select?: Record<string, unknown>; where?: Record<string, unknown> }) => unknown
    >;
    const call = messageFindFirst.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    if (!call) {
      throw new Error('expected conversationMessage.findFirst call');
    }
    expect(call).toEqual(
      objectContaining({
        where: objectContaining({
          id: 'message-1',
          deletedAt: null,
          thread: objectContaining({
            seasonId: 'season-1',
            status: { in: ['OPEN', 'READ_ONLY'] },
            members: objectContaining({
              some: objectContaining({
                participantId: 'participant-actor',
                memberState: 'ACTIVE',
              }),
            }),
          }),
        }),
      }),
    );
    expect(call.select).not.toHaveProperty('body');
    expect(call.select).not.toHaveProperty('retainedVaultObject');
    expect(call.select).not.toHaveProperty('encryptedPayload');
    expect(call.select).not.toHaveProperty('retentionAccessLog');
  });

  it('message가 없으면 null로 fail-closed한다', async () => {
    prisma.conversationMessage.findFirst.mockResolvedValue(null);

    await expect(
      resolver.resolveMessageTarget({
        actorParticipantId: 'participant-actor',
        seasonId: 'season-1',
        messageId: 'message-1',
      }),
    ).resolves.toBeNull();
  });
});
