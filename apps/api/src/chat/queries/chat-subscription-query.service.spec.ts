import { ChatSubscriptionQueryService } from './chat-subscription-query.service.js';

function createPrismaMock(count: number) {
  return {
    conversationThread: {
      count: jest.fn().mockResolvedValue(count),
    },
  };
}

describe('ChatSubscriptionQueryService', () => {
  it('ACTIVE member와 non-archived thread만 subscribe 가능하게 count query를 수행한다', async () => {
    const prisma = createPrismaMock(1);
    const service = new ChatSubscriptionQueryService(prisma as never);

    await expect(service.canSubscribeThreadForViewer('user-1', 'thread-1')).resolves.toBe(true);
    expect(prisma.conversationThread.count).toHaveBeenCalledWith({
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
              user: { deletedAt: null },
            },
          },
        },
      },
    });
  });

  it('count가 0이면 fail-closed 구독 불가로 수렴한다', async () => {
    const service = new ChatSubscriptionQueryService(createPrismaMock(0) as never);

    await expect(service.canSubscribeThreadForViewer('user-1', 'thread-1')).resolves.toBe(false);
  });
});
