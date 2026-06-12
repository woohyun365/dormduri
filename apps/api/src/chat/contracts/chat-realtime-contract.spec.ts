import * as chatContract from '@repo/shared/chat';
import * as chatRealtimeContract from '@repo/shared/chat/realtime-contract';
import * as chatRealtimeEvents from '@repo/shared/chat/realtime-events';

type SchemaLike = {
  parse(input: unknown): unknown;
  safeParse(input: unknown): { success: boolean; data?: unknown; error?: unknown };
};

function getSchema(exportName: string): SchemaLike {
  const value = (chatContract as Record<string, unknown>)[exportName];

  expect(typeof (value as { parse?: unknown } | undefined)?.parse).toBe('function');
  expect(typeof (value as { safeParse?: unknown } | undefined)?.safeParse).toBe('function');

  return value as SchemaLike;
}

describe('chat realtime shared contract guards', () => {
  it('dedicated realtime package exports는 chat-contract 통합 export와 같은 schema surface를 제공한다', () => {
    expect(chatRealtimeContract.updateChatReadMarkerRequestSchema).toBe(
      chatContract.updateChatReadMarkerRequestSchema,
    );
    expect(chatRealtimeContract.chatRealtimeReplayResponseSchema).toBe(
      chatContract.chatRealtimeReplayResponseSchema,
    );
    expect(chatRealtimeEvents.chatRealtimeEventSchema).toBe(chatContract.chatRealtimeEventSchema);
    expect(chatRealtimeEvents.chatRealtimeEventEnvelopeSchema).toBe(
      chatContract.chatRealtimeEventEnvelopeSchema,
    );
  });

  it('send message request는 clientMessageId를 필수 idempotency key로 요구하고 body 1..1000 trim invariant를 고정한다', () => {
    const schema = getSchema('sendConversationMessageRequestSchema');

    expect(
      schema.safeParse({
        targetUserId: 'user-2',
        body: '안녕하세요',
      }).success,
    ).toBe(false);

    expect(
      schema.safeParse({
        targetUserId: 'user-2',
        body: ' '.repeat(3),
        clientMessageId: 'client-message-1',
      }).success,
    ).toBe(false);

    expect(
      schema.safeParse({
        targetUserId: 'user-2',
        body: `${'가'.repeat(1000)}!`,
        clientMessageId: 'client-message-1',
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        targetUserId: 'user-2',
        body: '안녕하세요',
        clientMessageId: ' '.repeat(3),
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        targetUserId: 'user-2',
        body: '안녕하세요',
        clientMessageId: 'c'.repeat(129),
      }).success,
    ).toBe(false);

    expect(
      schema.parse({
        targetUserId: 'user-2',
        body: '  안녕하세요  ',
        clientMessageId: 'client-message-1',
      }),
    ).toMatchObject({
      targetUserId: 'user-2',
      body: '안녕하세요',
      clientMessageId: 'client-message-1',
    });
  });

  it('read marker request schema는 마지막으로 읽은 persisted message id만 받는다', () => {
    const schema = getSchema('updateChatReadMarkerRequestSchema');

    expect(
      schema.parse({
        lastReadMessageId: 'message-1',
      }),
    ).toEqual({ lastReadMessageId: 'message-1' });
    expect(schema.safeParse({}).success).toBe(false);
    expect(
      schema.safeParse({
        lastReadMessageId: 'message-1',
        counterpartReadReceiptVisible: true,
      }).success,
    ).toBe(false);
  });

  it('replay response schema는 bounded high-watermark replay와 resync-required failure를 모두 표현한다', () => {
    const schema = getSchema('chatRealtimeReplayResponseSchema');

    expect(
      schema.safeParse({
        ok: true,
        events: [],
        nextCursor: 'cursor-next',
        hasMore: false,
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        ok: false,
        reason: 'CURSOR_EXPIRED',
        resyncRequired: true,
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        ok: false,
        reason: 'CURSOR_EXPIRED',
        resyncRequired: false,
      }).success,
    ).toBe(false);
  });

  it('realtime event schema는 공통 envelope과 필수 event union을 고정하고 retained original body 노출을 거부한다', () => {
    const envelopeSchema = getSchema('chatRealtimeEventEnvelopeSchema');
    const eventSchema = getSchema('chatRealtimeEventSchema');
    const occurredAt = '2026-02-10T03:00:00.000Z';

    const messageCreatedEvent = {
      schemaVersion: 1,
      eventId: 'event-1',
      eventType: 'chat.message.created',
      occurredAt,
      cursor: 'cursor-1',
      threadId: 'thread-1',
      payload: {
        message: {
          id: 'message-1',
          senderUserId: 'user-1',
          body: '안녕하세요',
          bodyState: 'PLAIN',
          tombstoneReason: null,
          bodyVersion: 1,
          sentAt: occurredAt,
        },
      },
    } as const;

    expect(envelopeSchema.safeParse(messageCreatedEvent).success).toBe(true);
    expect(eventSchema.safeParse(messageCreatedEvent).success).toBe(true);

    expect(
      eventSchema.safeParse({
        schemaVersion: 1,
        eventId: 'event-2',
        eventType: 'chat.message.tombstoned',
        occurredAt,
        cursor: 'cursor-2',
        threadId: 'thread-1',
        payload: {
          messageId: 'message-1',
          body: '보관 정책에 따라 원문이 제한되었습니다.',
          bodyState: 'TOMBSTONED',
          tombstoneReason: 'ACCOUNT_DELETION_RETENTION',
          bodyVersion: 2,
          retainedOriginalBody: '노출되면 안 되는 원문',
        },
      }).success,
    ).toBe(false);

    expect(
      eventSchema.safeParse({
        ...messageCreatedEvent,
        eventId: 'event-3',
        cursor: 'cursor-3',
        payload: {
          message: {
            ...messageCreatedEvent.payload.message,
            retainedVaultObjectId: 'vault-object-1',
            retainedOriginalBody: '보존 vault 원문',
            internalAuditData: { accessedBy: 'admin-user' },
          },
        },
      }).success,
    ).toBe(false);

    expect(
      eventSchema.safeParse({
        schemaVersion: 1,
        eventId: 'event-resync-required',
        eventType: 'chat.resync.required',
        occurredAt,
        cursor: 'cursor-resync-required',
        payload: {
          reason: 'CURSOR_EXPIRED',
        },
      }).success,
    ).toBe(true);
  });

  it('thread realtime event payload는 lifecycle audit/debug metadata를 노출하지 않는다', () => {
    const eventSchema = getSchema('chatRealtimeEventSchema');
    const occurredAt = '2026-02-10T03:00:00.000Z';

    expect(
      eventSchema.safeParse({
        schemaVersion: 1,
        eventId: 'event-thread-updated-with-lifecycle-metadata',
        eventType: 'chat.thread.updated',
        occurredAt,
        cursor: 'cursor-thread-updated',
        threadId: 'thread-1',
        payload: {
          threadId: 'thread-1',
          status: 'READ_ONLY',
          closedReason: 'MODERATION',
          lifecycleEventId: 'lifecycle-event-1',
          sourceReportCaseId: 'report-case-1',
          sourceArchiveJobId: 'archive-job-1',
          metadata: {
            reportDetail: '노출되면 안 되는 신고 상세',
          },
        },
      }).success,
    ).toBe(false);
  });

  it('thread list contract는 bounded limit과 pageInfo cursor를 제공한다', () => {
    const querySchema = getSchema('listConversationThreadsQuerySchema');
    const responseSchema = getSchema('conversationThreadListResponseSchema');

    expect(querySchema.safeParse({ limit: 50, cursor: 'cursor-1' }).success).toBe(true);
    expect(querySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(
      responseSchema.safeParse({
        items: [],
        pageInfo: {
          hasNextPage: false,
          nextCursor: null,
        },
      }).success,
    ).toBe(true);
    expect(
      responseSchema.safeParse({
        items: [],
      }).success,
    ).toBe(false);
  });

  it('conversation stats contract는 current/past 시즌별 unique counterpart count를 표현한다', () => {
    const responseSchema = getSchema('conversationStatsResponseSchema');

    expect(
      responseSchema.safeParse({
        current: {
          seasonId: 'season-current',
          seasonName: '2026-1',
          conversationUserCount: 2,
        },
        past: [
          {
            seasonId: 'season-2025-2',
            seasonName: '2025-2',
            conversationUserCount: 1,
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      responseSchema.safeParse({
        current: null,
        past: [],
        conversationCount: 1,
      }).success,
    ).toBe(false);
  });
});
