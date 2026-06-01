type OutboxServiceConstructor = new (...args: unknown[]) => Record<string, unknown>;

type ChatRealtimeOutboxModule = {
  ChatRealtimeOutboxService?: OutboxServiceConstructor;
};

type OutboxEventCreateArgs = {
  data?: {
    eventType?: string;
    threadId?: string;
    payload?: Record<string, unknown>;
  };
};

type RecipientCreateManyArgs = {
  data?: Array<{ eventId?: string; userId?: string; cursor?: string }>;
};

async function loadOutboxModule(): Promise<ChatRealtimeOutboxModule> {
  const modulePath = './chat-realtime-outbox.service.js';
  return (await import(modulePath)) as ChatRealtimeOutboxModule;
}

function getMethod<T extends (...args: unknown[]) => unknown>(
  owner: Record<string, unknown>,
  methodName: string,
): T {
  const method = owner[methodName];
  expect(method).toEqual(expect.any(Function));
  return method as T;
}

describe('ChatRealtimeOutboxService red contract', () => {
  it('message commit은 같은 transaction 안에서 outbox event와 recipient rows를 만든다', async () => {
    const { ChatRealtimeOutboxService } = await loadOutboxModule();
    expect(ChatRealtimeOutboxService).toEqual(expect.any(Function));

    if (!ChatRealtimeOutboxService) {
      throw new Error('ChatRealtimeOutboxService export is required');
    }

    const service = new ChatRealtimeOutboxService({});
    const appendMessageCreated = getMethod<(...args: unknown[]) => Promise<unknown>>(
      service,
      'appendMessageCreated',
    );
    const createOutboxEvent = jest.fn().mockResolvedValue({ id: 'event-1' });
    const createRecipients = jest.fn().mockResolvedValue({ count: 2 });
    const tx = {
      chatRealtimeOutboxEvent: { create: createOutboxEvent },
      chatRealtimeEventRecipient: { createMany: createRecipients },
    };

    await appendMessageCreated.call(service, tx, {
      threadId: 'thread-1',
      actorUserId: 'user-1',
      message: {
        id: 'message-1',
        body: '안녕하세요',
        senderUserId: 'user-1',
        sentAt: new Date('2026-02-10T03:00:00.000Z'),
      },
      recipientUserIds: ['user-1', 'user-2'],
    });

    const outboxCalls = createOutboxEvent.mock.calls as Array<[OutboxEventCreateArgs]>;
    expect(outboxCalls[0]?.[0].data).toMatchObject({
      eventType: 'chat.message.created',
      threadId: 'thread-1',
    });

    const recipientCalls = createRecipients.mock.calls as Array<[RecipientCreateManyArgs]>;
    expect(recipientCalls[0]?.[0].data?.map((row) => row.userId)).toEqual(
      expect.arrayContaining(['user-1', 'user-2']),
    );
    const recipientRows = recipientCalls[0]?.[0].data ?? [];
    expect(
      recipientRows.some(
        (row) => row.eventId === 'event-1' && typeof row.cursor === 'string' && row.cursor !== '',
      ),
    ).toBe(true);
  });

  it('recipient 생성 실패는 삼키지 않고 transaction rollback으로 수렴하게 노출한다', async () => {
    const { ChatRealtimeOutboxService } = await loadOutboxModule();
    expect(ChatRealtimeOutboxService).toEqual(expect.any(Function));

    if (!ChatRealtimeOutboxService) {
      throw new Error('ChatRealtimeOutboxService export is required');
    }

    const service = new ChatRealtimeOutboxService({});
    const appendMessageCreated = getMethod<(...args: unknown[]) => Promise<unknown>>(
      service,
      'appendMessageCreated',
    );
    const recipientFailure = new Error('recipient insert failed');
    const createOutboxEvent = jest.fn().mockResolvedValue({ id: 'event-rollback' });
    const createRecipients = jest.fn().mockRejectedValue(recipientFailure);
    const tx = {
      chatRealtimeOutboxEvent: { create: createOutboxEvent },
      chatRealtimeEventRecipient: { createMany: createRecipients },
    };

    await expect(
      appendMessageCreated.call(service, tx, {
        threadId: 'thread-1',
        actorUserId: 'user-1',
        message: {
          id: 'message-rollback',
          body: '롤백 검증',
          senderUserId: 'user-1',
          sentAt: new Date('2026-02-10T03:00:00.000Z'),
        },
        recipientUserIds: ['user-1', 'user-2'],
      }),
    ).rejects.toBe(recipientFailure);

    expect(createOutboxEvent).toHaveBeenCalled();
    expect(createRecipients).toHaveBeenCalled();
  });

  it('tombstone event는 retained original body 없이 outbox payload에 저장된다', async () => {
    const { ChatRealtimeOutboxService } = await loadOutboxModule();
    expect(ChatRealtimeOutboxService).toEqual(expect.any(Function));

    if (!ChatRealtimeOutboxService) {
      throw new Error('ChatRealtimeOutboxService export is required');
    }

    const service = new ChatRealtimeOutboxService({});
    const appendTombstone = getMethod<(...args: unknown[]) => Promise<unknown>>(
      service,
      'appendMessageTombstoned',
    );
    const createOutboxEvent = jest.fn().mockResolvedValue({ id: 'event-2' });
    const tx = {
      chatRealtimeOutboxEvent: { create: createOutboxEvent },
      chatRealtimeEventRecipient: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };

    await appendTombstone.call(service, tx, {
      threadId: 'thread-1',
      messageId: 'message-1',
      body: '보관 정책에 따라 원문이 제한되었습니다.',
      bodyState: 'TOMBSTONED',
      tombstoneReason: 'ACCOUNT_DELETION_RETENTION',
      bodyVersion: 2,
      retainedOriginalBody: '노출되면 안 되는 원문',
      recipientUserIds: ['user-1', 'user-2'],
    });

    const outboxCalls = createOutboxEvent.mock.calls as Array<[OutboxEventCreateArgs]>;
    expect(outboxCalls[0]?.[0].data?.eventType).toBe('chat.message.tombstoned');
    expect(outboxCalls[0]?.[0].data?.payload).not.toHaveProperty('retainedOriginalBody');
  });
});
