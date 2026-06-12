import { beforeEach, describe, expect, it } from 'vitest';
import {
  createChatServiceSpecHarness,
  makeAuthUser,
  makeSendMessageInput,
  makeThread,
  makeVisibleThread,
  type ChatServiceSpecHarness,
} from '../test-support/chat-service-spec.harness.js';

describe('ChatService facade', () => {
  let service: ChatServiceSpecHarness['service'];
  let prisma: ChatServiceSpecHarness['prisma'];
  let txConversationThreadFindFirst: ChatServiceSpecHarness['txConversationThreadFindFirst'];
  let txConversationThreadMemberCount: ChatServiceSpecHarness['txConversationThreadMemberCount'];
  let txConversationMessageFindFirst: ChatServiceSpecHarness['txConversationMessageFindFirst'];
  let txConversationThreadUpdate: ChatServiceSpecHarness['txConversationThreadUpdate'];
  let expectMessageCreateClientMessageId: ChatServiceSpecHarness['expectMessageCreateClientMessageId'];

  beforeEach(() => {
    const harness = createChatServiceSpecHarness();
    ({
      prisma,
      service,
      txConversationThreadFindFirst,
      txConversationMessageFindFirst,
      txConversationThreadMemberCount,
      txConversationThreadUpdate,
      expectMessageCreateClientMessageId,
    } = harness);
  });

  it('controller-facing public methods만 노출하고 block side-effect owner로 자라지 않는다', () => {
    expect(typeof service.getThreadEntry).toBe('function');
    expect(typeof service.sendMessage).toBe('function');
    expect(typeof service.updateReadMarker).toBe('function');
    expect(typeof service.leaveThread).toBe('function');
    expect(typeof service.listThreads).toBe('function');
    expect(typeof service.getThreadDetail).toBe('function');
    expect(typeof service.canSubscribeThread).toBe('function');
    expect(typeof service.replayRealtimeEvents).toBe('function');
    expect(Object.prototype.hasOwnProperty.call(service, `close${'DirectThreadsForBlock'}`)).toBe(
      false,
    );
  });

  it('pair entry read path는 facade를 통해 접근해도 thread 생성 transaction을 열지 않는다', async () => {
    const result = await service.getThreadEntry(makeAuthUser(), 'user-2');

    expect(result.thread).toBeNull();
    expect(result.canSendMessage).toBe(true);
    expect(prisma.conversationThread.findFirst).toHaveBeenCalled();
    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
  });

  it('sendMessage facade는 command owner의 serializable transaction path로 위임한다', async () => {
    await service.sendMessage(
      makeAuthUser(),
      makeSendMessageInput('facade smoke', 'client-message-facade-smoke'),
    );

    expect(prisma.runSerializableTransaction).toHaveBeenCalledTimes(1);
    expectMessageCreateClientMessageId('client-message-facade-smoke');
  });

  it('updateReadMarker facade는 command owner transaction path로 위임한다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeVisibleThread({ threadKind: 'DIRECT', status: 'OPEN' }),
    );
    txConversationMessageFindFirst.mockResolvedValueOnce({
      id: 'message-next',
      sentAt: new Date('2026-02-10T03:01:00.000Z'),
    });

    await service.updateReadMarker(makeAuthUser(), 'thread-1', {
      lastReadMessageId: 'message-next',
    });

    expect(prisma.runSerializableTransaction).toHaveBeenCalledTimes(1);
    expect(txConversationThreadFindFirst).toHaveBeenCalled();
  });

  it('leaveThread facade는 command owner transaction path로 위임한다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeVisibleThread({ threadKind: 'DIRECT', status: 'OPEN' }),
    );
    txConversationThreadFindFirst.mockResolvedValue(
      makeVisibleThread({ threadKind: 'DIRECT', status: 'OPEN' }),
    );
    txConversationThreadMemberCount.mockResolvedValue(1);

    await expect(service.leaveThread(makeAuthUser(), 'thread-1')).resolves.toEqual({
      threadId: 'thread-1',
      archived: false,
    });

    expect(prisma.runSerializableTransaction).toHaveBeenCalledTimes(1);
    const threadUpdateCalls = txConversationThreadUpdate.mock.calls as Array<
      [{ data?: { status?: string } }]
    >;
    expect(
      threadUpdateCalls.some(
        ([threadUpdateInput]) => threadUpdateInput.data?.status === 'ARCHIVED',
      ),
    ).toBe(false);
  });

  it('thread detail facade는 query/lifecycle owner를 통해 detail response를 조립한다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeThread({ status: 'READ_ONLY', closedReason: 'SEASON_ENDED', messages: [] }),
    );

    await expect(service.getThreadDetail(makeAuthUser(), 'thread-1')).resolves.toMatchObject({
      thread: { id: 'thread-1', status: 'READ_ONLY', canSendMessage: false },
      messages: [],
    });
    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
  });
});
