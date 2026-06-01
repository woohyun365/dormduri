import { ChatRealtimePublisher } from './chat-realtime-publisher.js';

function createServerMock() {
  const emits: Array<{ room: string; eventName: string; payload: unknown }> = [];
  return {
    emits,
    server: {
      to: jest.fn((room: string) => ({
        emit: jest.fn((eventName: string, payload: unknown) => {
          emits.push({ room, eventName, payload });
        }),
      })),
    },
  };
}

describe('ChatRealtimePublisher', () => {
  const outboxEvent = {
    id: 'event-1',
    eventType: 'chat.read_marker.updated',
    schemaVersion: 1,
    threadId: 'thread-1',
    aggregateType: 'conversation.thread_member',
    aggregateId: 'thread-1',
    aggregateVersion: null,
    payload: {
      threadId: 'thread-1',
      lastReadMessageId: 'message-1',
    },
    roomKeys: ['user:user-1', 'thread:thread-1'],
    occurredAt: new Date('2026-02-10T03:00:00.000Z'),
    availableAt: new Date('2026-02-10T03:00:00.000Z'),
    publishAttempts: 1,
  };

  it('recipient user room에는 recipient cursor를 포함한 chat.event를 emit한다', () => {
    const publisher = new ChatRealtimePublisher();
    const { server, emits } = createServerMock();
    publisher.bindServer(server as never);

    publisher.publishOutboxEvent({
      event: outboxEvent,
      recipients: [
        {
          eventId: 'event-1',
          userId: 'user-1',
          threadId: 'thread-1',
          cursor: 'event-1:user-1',
        },
      ],
    });

    const userEmit = emits.find((emit) => emit.room === 'user:user-1');
    expect(userEmit).toMatchObject({
      room: 'user:user-1',
      eventName: 'chat.event',
    });
    expect(userEmit?.payload).toMatchObject({
      eventId: 'event-1',
      cursor: 'event-1:user-1',
      eventType: 'chat.read_marker.updated',
    });
  });

  it('thread room subscriber도 dispatcher room emit event를 받을 수 있다', () => {
    const publisher = new ChatRealtimePublisher();
    const { server, emits } = createServerMock();
    publisher.bindServer(server as never);

    publisher.publishOutboxEvent({
      event: {
        ...outboxEvent,
        roomKeys: ['thread:thread-1'],
      },
      recipients: [],
    });

    expect(emits).toHaveLength(1);
    expect(emits[0]).toMatchObject({
      room: 'thread:thread-1',
      eventName: 'chat.event',
    });
    expect(emits[0]?.payload).toMatchObject({
      eventId: 'event-1',
      cursor: 'event-1',
    });
  });

  it('server가 bind되지 않았으면 publish를 실패시켜 dispatcher retry로 수렴하게 한다', () => {
    const publisher = new ChatRealtimePublisher();

    expect(() =>
      publisher.publishOutboxEvent({
        event: outboxEvent,
        recipients: [],
      }),
    ).toThrow(/server is not bound/);
  });
});
