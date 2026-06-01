import { createChatQueryOwner } from './chat-query-owner.js';

describe('ChatQueryOwner realtime subscribe read boundary', () => {
  it('subscribe authorization은 ACTIVE member와 non-archived thread만 pure count query로 확인한다', async () => {
    const count = jest.fn().mockResolvedValue(1);
    const prisma = {
      conversationThread: {
        count,
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      chatRealtimeOutboxEvent: {
        create: jest.fn(),
      },
    };
    const owner = createChatQueryOwner(prisma as never);

    await expect(owner.canSubscribeThreadForViewer('user-1', 'thread-1')).resolves.toBe(true);

    expect(count).toHaveBeenCalledWith({
      where: {
        id: 'thread-1',
        status: { in: ['OPEN', 'READ_ONLY'] },
        members: {
          some: {
            memberState: 'ACTIVE',
            participant: {
              userId: 'user-1',
              hiddenByAdminAt: null,
              deactivatedAt: null,
              user: {
                deletedAt: null,
              },
            },
          },
        },
      },
    });
    expect(prisma.conversationThread.update).not.toHaveBeenCalled();
    expect(prisma.conversationThread.updateMany).not.toHaveBeenCalled();
    expect(prisma.chatRealtimeOutboxEvent.create).not.toHaveBeenCalled();
  });

  it('subscribe authorization count가 0이면 archived/left/deleted/inactive 상태를 fail-closed로 거절한다', async () => {
    const prisma = {
      conversationThread: {
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const owner = createChatQueryOwner(prisma as never);

    await expect(owner.canSubscribeThreadForViewer('user-1', 'thread-1')).resolves.toBe(false);
  });
});
