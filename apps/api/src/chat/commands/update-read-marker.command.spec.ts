import { beforeEach, describe, expect, it } from 'vitest';
import { chatErrors } from '../errors/chat.errors.js';
import {
  createChatServiceSpecHarness,
  makeThread,
  makeVisibleThread,
  type ChatServiceSpecHarness,
} from '../test-support/chat-service-spec.harness.js';

describe('update read marker command regression', () => {
  let prisma: ChatServiceSpecHarness['prisma'];
  let seasonsService: ChatServiceSpecHarness['seasonsService'];
  let service: ChatServiceSpecHarness['service'];
  let txChatRealtimeEventRecipientCreateMany: ChatServiceSpecHarness['txChatRealtimeEventRecipientCreateMany'];
  let txChatRealtimeOutboxEventCreate: ChatServiceSpecHarness['txChatRealtimeOutboxEventCreate'];
  let txConversationMessageFindFirst: ChatServiceSpecHarness['txConversationMessageFindFirst'];
  let txConversationThreadFindFirst: ChatServiceSpecHarness['txConversationThreadFindFirst'];
  let txConversationThreadMemberFindUnique: ChatServiceSpecHarness['txConversationThreadMemberFindUnique'];
  let txConversationThreadMemberUpdate: ChatServiceSpecHarness['txConversationThreadMemberUpdate'];
  let txConversationThreadUpdate: ChatServiceSpecHarness['txConversationThreadUpdate'];

  beforeEach(() => {
    const harness = createChatServiceSpecHarness();
    ({
      prisma,
      seasonsService,
      service,
      txChatRealtimeEventRecipientCreateMany,
      txChatRealtimeOutboxEventCreate,
      txConversationMessageFindFirst,
      txConversationThreadFindFirst,
      txConversationThreadMemberFindUnique,
      txConversationThreadMemberUpdate,
      txConversationThreadUpdate,
    } = harness);
  });

  it('read marker는 현재 위치가 없으면 지정한 메시지로 전진한다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeVisibleThread({ threadKind: 'DIRECT', status: 'READ_ONLY' }),
    );
    txConversationThreadMemberFindUnique.mockResolvedValue({
      memberState: 'ACTIVE',
      lastReadMessageId: null,
    });
    txConversationMessageFindFirst.mockResolvedValueOnce({
      id: 'message-new',
      sentAt: new Date('2026-02-10T02:00:00.000Z'),
    });

    const result = await service.updateReadMarker(
      {
        id: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      'thread-1',
      { lastReadMessageId: 'message-new' },
    );

    expect(txConversationThreadMemberUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          threadId_participantId: {
            threadId: 'thread-1',
            participantId: 'participant-1',
          },
        },
        data: {
          lastReadAt: new Date('2026-02-10T03:00:00.000Z'),
          lastReadMessageId: 'message-new',
        },
      }),
    );
    expect(result).toMatchObject({
      threadId: 'thread-1',
      lastReadMessageId: 'message-new',
      lastReadAt: '2026-02-10T03:00:00.000Z',
    });
    const outboxCreateCalls = txChatRealtimeOutboxEventCreate.mock.calls as Array<
      [{ data?: { eventType?: string; payload?: Record<string, unknown> } }]
    >;
    expect(outboxCreateCalls.at(-1)?.[0].data).toMatchObject({
      eventType: 'chat.read_marker.updated',
      payload: {
        threadId: 'thread-1',
        lastReadMessageId: 'message-new',
      },
    });
    const recipientCreateCalls = txChatRealtimeEventRecipientCreateMany.mock.calls as Array<
      [{ data?: Array<{ userId?: string }> }]
    >;
    expect(recipientCreateCalls.at(-1)?.[0].data).toEqual([
      expect.objectContaining({ userId: 'user-1' }),
    ]);
  });
  it('read marker는 transaction 내부 lifecycle sync 결과 ARCHIVED가 된 thread를 갱신하지 않는다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeThread({ status: 'READ_ONLY', closedReason: 'SEASON_ENDED' }),
    );
    seasonsService.getCurrentSeasonContext
      .mockResolvedValueOnce({
        season: { id: 'season-1' },
        state: 'SEASON_MATCHING',
        operatedDormitories: [
          { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
        ],
        schedule: {
          preparationStart: '2026-02-01',
          matchingStart: '2026-02-05',
          matchingEnd: '2026-02-11',
          seasonEnd: '2026-02-28',
        },
      })
      .mockResolvedValueOnce({
        season: { id: 'season-2' },
        state: 'SEASON_OPEN',
        operatedDormitories: [
          { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2027-01-11' },
        ],
        schedule: {
          preparationStart: '2027-01-01',
          matchingStart: '2027-01-05',
          matchingEnd: '2027-01-11',
          seasonEnd: '2027-01-28',
        },
      });
    txConversationThreadFindFirst.mockResolvedValue(
      makeThread({ status: 'READ_ONLY', closedReason: 'SEASON_ENDED' }),
    );
    txConversationThreadUpdate.mockResolvedValue(
      makeThread({
        status: 'ARCHIVED',
        closedReason: 'SEASON_ENDED',
        closedAt: new Date('2026-02-10T03:00:00.000Z'),
      }),
    );

    await expect(
      service.updateReadMarker(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'thread-1',
        { lastReadMessageId: 'message-new' },
      ),
    ).rejects.toMatchObject({
      response: chatErrors.threadNotFound().getResponse(),
    });
    expect(prisma.runSerializableTransaction).toHaveBeenCalled();
    expect(txConversationThreadMemberUpdate).not.toHaveBeenCalled();
    const outboxCreateCalls = txChatRealtimeOutboxEventCreate.mock.calls as Array<
      [{ data?: { eventType?: string } }]
    >;
    const outboxEventTypes = outboxCreateCalls.map((call) => call[0].data?.eventType);
    expect(outboxEventTypes).not.toContain('chat.read_marker.updated');
  });
  it('read marker는 뒤로 이동할 수 없다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(
      makeVisibleThread({ threadKind: 'DIRECT', status: 'READ_ONLY' }),
    );
    txConversationMessageFindFirst
      .mockResolvedValueOnce({
        id: 'message-old',
        sentAt: new Date('2026-02-10T01:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'message-current',
        sentAt: new Date('2026-02-10T02:00:00.000Z'),
      });

    const candidate = service as unknown as {
      updateReadMarker?: (
        authUser: { id: string; gender: 'M'; campus: 'CHUNCHEON' },
        threadId: string,
        input: { lastReadMessageId: string },
      ) => Promise<unknown>;
    };

    expect(candidate.updateReadMarker).toEqual(expect.any(Function));

    if (!candidate.updateReadMarker) {
      throw new Error('ChatService.updateReadMarker must be implemented');
    }

    await expect(
      candidate.updateReadMarker(
        {
          id: 'user-1',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        'thread-1',
        { lastReadMessageId: 'message-old' },
      ),
    ).rejects.toMatchObject({
      response: { code: 'CHAT_READ_MARKER_CANNOT_MOVE_BACKWARD' },
    });
  });
});
