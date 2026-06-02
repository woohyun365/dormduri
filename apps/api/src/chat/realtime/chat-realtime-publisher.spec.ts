import { ChatRealtimePublisher } from './chat-realtime-publisher.js';

function createServerMock() {
  const emits: Array<{ room: string; eventName: string; payload: unknown }> = [];
  const socketsLeaveCalls: Array<{ sourceRoom: string; targetRoom: string }> = [];
  return {
    emits,
    socketsLeaveCalls,
    server: {
      to: jest.fn((room: string) => ({
        emit: jest.fn((eventName: string, payload: unknown) => {
          emits.push({ room, eventName, payload });
        }),
      })),
      in: jest.fn((sourceRoom: string) => ({
        socketsLeave: jest.fn((targetRoom: string) => {
          socketsLeaveCalls.push({ sourceRoom, targetRoom });
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

  it('thread.updated outbox event는 recipient user room으로 socket event를 emit한다', () => {
    const publisher = new ChatRealtimePublisher();
    const { server, emits, socketsLeaveCalls } = createServerMock();
    publisher.bindServer(server as never);

    publisher.publishOutboxEvent({
      event: {
        ...outboxEvent,
        id: 'event-thread-updated',
        eventType: 'chat.thread.updated',
        aggregateType: 'conversation.thread',
        aggregateId: 'thread-1',
        payload: {
          threadId: 'thread-1',
          status: 'READ_ONLY',
          closedReason: 'ACTIVE_MATCH_CREATED',
        },
        roomKeys: ['user:user-1', 'user:user-3'],
      },
      recipients: [
        {
          eventId: 'event-thread-updated',
          userId: 'user-1',
          threadId: 'thread-1',
          cursor: 'event-thread-updated:user-1',
        },
        {
          eventId: 'event-thread-updated',
          userId: 'user-3',
          threadId: 'thread-1',
          cursor: 'event-thread-updated:user-3',
        },
      ],
    });

    const user1Emit = emits.find((emit) => emit.room === 'user:user-1');
    expect(user1Emit).toMatchObject({
      room: 'user:user-1',
      eventName: 'chat.event',
    });
    expect(user1Emit?.payload).toMatchObject({
      eventId: 'event-thread-updated',
      cursor: 'event-thread-updated:user-1',
      eventType: 'chat.thread.updated',
      payload: {
        threadId: 'thread-1',
        status: 'READ_ONLY',
        closedReason: 'ACTIVE_MATCH_CREATED',
      },
    });

    const user3Emit = emits.find((emit) => emit.room === 'user:user-3');
    expect(user3Emit).toMatchObject({
      room: 'user:user-3',
      eventName: 'chat.event',
    });
    expect(user3Emit?.payload).toMatchObject({
      eventId: 'event-thread-updated',
      cursor: 'event-thread-updated:user-3',
      eventType: 'chat.thread.updated',
    });
    expect(socketsLeaveCalls).toEqual([]);
  });

  it('member.left event publish 후 leaving user socket은 thread room에서 server-side leave 처리된다', () => {
    const publisher = new ChatRealtimePublisher();
    const { server, emits, socketsLeaveCalls } = createServerMock();
    publisher.bindServer(server as never);

    publisher.publishOutboxEvent({
      event: {
        ...outboxEvent,
        id: 'event-member-left',
        eventType: 'chat.member.left',
        aggregateType: 'conversation.thread_member',
        aggregateId: 'participant-1',
        payload: {
          threadId: 'thread-1',
          participantId: 'participant-1',
          userId: 'user-1',
          leftAt: '2026-02-10T03:00:00.000Z',
        },
        roomKeys: ['user:user-1', 'user:user-2'],
      },
      recipients: [
        {
          eventId: 'event-member-left',
          userId: 'user-1',
          threadId: 'thread-1',
          cursor: 'event-member-left:user-1',
        },
        {
          eventId: 'event-member-left',
          userId: 'user-2',
          threadId: 'thread-1',
          cursor: 'event-member-left:user-2',
        },
      ],
    });

    expect(emits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ room: 'user:user-1', eventName: 'chat.event' }),
        expect.objectContaining({ room: 'user:user-2', eventName: 'chat.event' }),
      ]),
    );
    expect(socketsLeaveCalls).toEqual([
      {
        sourceRoom: 'user:user-1',
        targetRoom: 'thread:thread-1',
      },
    ]);
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
