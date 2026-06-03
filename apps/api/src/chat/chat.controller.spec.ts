import { BadRequestException } from '@nestjs/common';
import { AUTH_ACCESS_METADATA_KEY } from '../auth/auth-access.decorator.js';
import { ChatController } from './chat.controller.js';

function getBadRequestResponse(error: unknown) {
  expect(error).toBeInstanceOf(BadRequestException);

  if (!(error instanceof BadRequestException)) {
    throw new Error('Expected BadRequestException');
  }

  const response = error.getResponse();
  expect(typeof response).toBe('object');
  expect(response).not.toBeNull();

  if (typeof response !== 'object' || response === null) {
    throw new Error('Expected object response');
  }

  return response as { code: string; fieldErrors?: Record<string, string[]> };
}

async function expectBadRequest(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    return getBadRequestResponse(error);
  }

  throw new Error('Expected BadRequestException');
}

describe('ChatController', () => {
  const chatService = {
    listThreads: jest.fn(),
    getConversationStats: jest.fn(),
    getThreadEntry: jest.fn(),
    getThreadDetail: jest.fn(),
    leaveThread: jest.fn(),
    updateReadMarker: jest.fn(),
    replayRealtimeEvents: jest.fn(),
    sendMessage: jest.fn(),
  };
  const realtimeTicketService = {
    issueTicketFromAccessToken: jest.fn(),
  };
  const rateLimiter = {
    resolveRequestIp: jest.fn(),
    consumeMessageSend: jest.fn(),
    consumeRealtimeTicket: jest.fn(),
  };
  const metrics = {
    recordRateLimitRejection: jest.fn(),
    recordReplayResyncRequired: jest.fn(),
  };

  const controller = new ChatController(
    chatService as never,
    realtimeTicketService as never,
    rateLimiter as never,
    metrics as never,
  );
  const authUser = {
    id: 'user-1',
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    rateLimiter.consumeMessageSend.mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
      scope: 'chat:message:user',
    });
    rateLimiter.consumeRealtimeTicket.mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
      scope: 'chat:ticket:user',
    });
    rateLimiter.resolveRequestIp.mockReturnValue('203.0.113.20');
  });

  it('controller class는 protected auth metadata로 보호된다', () => {
    expect(Reflect.getMetadata(AUTH_ACCESS_METADATA_KEY, ChatController)).toBe('protected');
  });

  it('thread list query는 bounded limit/cursor로 service에 전달한다', async () => {
    chatService.listThreads.mockResolvedValueOnce({
      items: [],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });

    await expect(controller.getThreads(authUser as never, '25', ' cursor-1 ')).resolves.toEqual({
      items: [],
      pageInfo: { hasNextPage: false, nextCursor: null },
    });

    expect(chatService.listThreads).toHaveBeenCalledWith(authUser, {
      limit: 25,
      cursor: 'cursor-1',
    });
  });

  it('thread list limit이 허용 범위를 벗어나면 bad request로 거절한다', async () => {
    const response = await expectBadRequest(() => controller.getThreads(authUser as never, '51'));

    expect(response.code).toBe('INVALID_QUERY');
    expect(chatService.listThreads).not.toHaveBeenCalled();
  });

  it('conversation stats는 chat service의 read-only stats surface로 위임한다', async () => {
    chatService.getConversationStats.mockResolvedValueOnce({
      current: {
        seasonId: 'season-current',
        seasonName: '2026-1',
        conversationUserCount: 1,
      },
      past: [],
    });

    await expect(controller.getConversationStats(authUser as never)).resolves.toEqual({
      current: {
        seasonId: 'season-current',
        seasonName: '2026-1',
        conversationUserCount: 1,
      },
      past: [],
    });

    expect(chatService.getConversationStats).toHaveBeenCalledWith(authUser);
  });

  it('빈 message body는 bad request를 던진다', async () => {
    const response = await expectBadRequest(() =>
      controller.sendMessage(authUser as never, {
        targetUserId: 'user-2',
        body: '   ',
        clientMessageId: 'client-message-empty-body',
      }),
    );
    expect(response.code).toBe('INVALID_REQUEST_BODY');
  });

  it('clientMessageId 없는 메시지 전송 요청은 bad request로 거절한다', async () => {
    const response = await expectBadRequest(() =>
      controller.sendMessage(authUser as never, {
        targetUserId: 'user-2',
        body: '안녕하세요',
      }),
    );
    expect(response.code).toBe('INVALID_REQUEST_BODY');
    expect(response.fieldErrors?.clientMessageId).toEqual(
      expect.arrayContaining([expect.any(String)]),
    );
  });

  it('1,000자를 초과하는 메시지 본문은 bad request로 거절한다', async () => {
    const response = await expectBadRequest(() =>
      controller.sendMessage(authUser as never, {
        targetUserId: 'user-2',
        body: `${'가'.repeat(1000)}!`,
        clientMessageId: 'client-message-1',
      }),
    );
    expect(response.code).toBe('INVALID_REQUEST_BODY');
    expect(response.fieldErrors?.body).toEqual(expect.arrayContaining([expect.any(String)]));
  });

  it('유효한 메시지 전송 요청은 clientMessageId를 service로 전달한다', async () => {
    chatService.sendMessage.mockResolvedValueOnce({
      thread: { id: 'thread-1' },
      message: { id: 'message-1' },
      createdThread: false,
    });

    await expect(
      controller.sendMessage(authUser as never, {
        targetUserId: 'user-2',
        body: '  안녕하세요  ',
        clientMessageId: 'client-message-1',
      }),
    ).resolves.toMatchObject({ message: { id: 'message-1' } });

    expect(rateLimiter.consumeMessageSend).toHaveBeenCalledWith({
      userId: 'user-1',
      targetUserId: 'user-2',
    });
    expect(chatService.sendMessage).toHaveBeenCalledWith(
      authUser,
      expect.objectContaining({
        targetUserId: 'user-2',
        body: '안녕하세요',
        clientMessageId: 'client-message-1',
      }),
    );
  });

  it('message rate limit 초과 시 ChatService.sendMessage를 호출하지 않는다', async () => {
    rateLimiter.consumeMessageSend.mockReturnValueOnce({
      allowed: false,
      retryAfterSeconds: 9,
      scope: 'chat:message:user',
    });

    await expect(
      controller.sendMessage(authUser as never, {
        targetUserId: 'user-2',
        body: '안녕하세요',
        clientMessageId: 'client-message-rate-limited',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'CHAT_REALTIME_RATE_LIMITED',
        retryAfterSeconds: 9,
        scope: 'chat:message:user',
      },
    });

    expect(metrics.recordRateLimitRejection).toHaveBeenCalledWith('chat:message:user');
    expect(chatService.sendMessage).not.toHaveBeenCalled();
  });

  it('read marker 갱신 route handler를 제공한다', () => {
    const candidate = controller as unknown as {
      updateReadMarker?: (...args: readonly unknown[]) => Promise<unknown>;
    };

    expect(candidate.updateReadMarker).toEqual(expect.any(Function));
  });

  it('read marker 갱신 요청은 lastReadMessageId를 필수로 검증한다', async () => {
    const response = await expectBadRequest(() =>
      controller.updateReadMarker(authUser as never, 'thread-1', {}),
    );

    expect(response.code).toBe('INVALID_REQUEST_BODY');
    expect(response.fieldErrors?.lastReadMessageId).toEqual(
      expect.arrayContaining([expect.any(String)]),
    );
    expect(chatService.updateReadMarker).not.toHaveBeenCalled();
  });

  it('유효한 read marker 갱신 요청은 service로 전달한다', async () => {
    chatService.updateReadMarker.mockResolvedValueOnce({
      threadId: 'thread-1',
      lastReadMessageId: 'message-1',
      lastReadAt: '2026-02-10T03:00:00.000Z',
    });

    await expect(
      controller.updateReadMarker(authUser as never, 'thread-1', {
        lastReadMessageId: 'message-1',
      }),
    ).resolves.toMatchObject({ lastReadMessageId: 'message-1' });

    expect(chatService.updateReadMarker).toHaveBeenCalledWith(authUser, 'thread-1', {
      lastReadMessageId: 'message-1',
    });
  });

  it('replay 요청은 after cursor와 limit을 service로 전달한다', async () => {
    chatService.replayRealtimeEvents.mockResolvedValueOnce({
      ok: true,
      events: [],
      nextCursor: null,
      hasMore: false,
    });

    await expect(
      controller.replayRealtimeEvents(authUser as never, ' cursor-1 ', '25'),
    ).resolves.toEqual({
      ok: true,
      events: [],
      nextCursor: null,
      hasMore: false,
    });

    expect(chatService.replayRealtimeEvents).toHaveBeenCalledWith(authUser, {
      after: 'cursor-1',
      limit: 25,
    });
    expect(metrics.recordReplayResyncRequired).not.toHaveBeenCalled();
  });

  it('replay resync-required 응답은 reason별 metric으로 기록한다', async () => {
    chatService.replayRealtimeEvents.mockResolvedValueOnce({
      ok: false,
      reason: 'CURSOR_EXPIRED',
      resyncRequired: true,
    });

    await expect(controller.replayRealtimeEvents(authUser as never)).resolves.toEqual({
      ok: false,
      reason: 'CURSOR_EXPIRED',
      resyncRequired: true,
    });

    expect(metrics.recordReplayResyncRequired).toHaveBeenCalledWith('CURSOR_EXPIRED');
  });

  it('replay limit이 허용 범위를 벗어나면 bad request로 거절한다', async () => {
    const response = await expectBadRequest(() =>
      controller.replayRealtimeEvents(authUser as never, undefined, '101'),
    );

    expect(response.code).toBe('INVALID_QUERY');
    expect(response.fieldErrors?.limit).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(chatService.replayRealtimeEvents).not.toHaveBeenCalled();
  });

  it('realtime ticket endpoint는 bearer access token으로 60초 ticket을 발급한다', async () => {
    realtimeTicketService.issueTicketFromAccessToken.mockResolvedValueOnce({
      ticket: 'ticket-1',
      scope: 'chat:realtime',
      expiresAt: '2026-02-10T03:01:00.000Z',
    });

    await expect(
      controller.issueRealtimeTicket(authUser as never, 'Bearer access-token-1', {
        headers: { 'x-forwarded-for': '203.0.113.20' },
      } as never),
    ).resolves.toEqual({
      ticket: 'ticket-1',
      scope: 'chat:realtime',
      expiresAt: '2026-02-10T03:01:00.000Z',
    });

    expect(rateLimiter.consumeRealtimeTicket).toHaveBeenCalledWith({
      userId: 'user-1',
      ip: '203.0.113.20',
    });
    expect(rateLimiter.resolveRequestIp).toHaveBeenCalledWith({
      headers: { 'x-forwarded-for': '203.0.113.20' },
    });
    expect(realtimeTicketService.issueTicketFromAccessToken).toHaveBeenCalledWith('access-token-1');
  });

  it('realtime ticket 발급 실패는 unauthenticated로 거절한다', async () => {
    realtimeTicketService.issueTicketFromAccessToken.mockResolvedValueOnce(null);

    await expect(
      controller.issueRealtimeTicket(authUser as never, undefined),
    ).rejects.toMatchObject({
      response: { code: 'UNAUTHENTICATED' },
    });
  });

  it('realtime ticket rate limit 초과 시 새 ticket을 발급하지 않는다', async () => {
    rateLimiter.consumeRealtimeTicket.mockReturnValueOnce({
      allowed: false,
      retryAfterSeconds: 30,
      scope: 'chat:ticket:user',
    });

    await expect(
      controller.issueRealtimeTicket(authUser as never, 'Bearer access-token-1'),
    ).rejects.toMatchObject({
      response: {
        code: 'CHAT_REALTIME_RATE_LIMITED',
        retryAfterSeconds: 30,
        scope: 'chat:ticket:user',
      },
    });

    expect(metrics.recordRateLimitRejection).toHaveBeenCalledWith('chat:ticket:user');
    expect(realtimeTicketService.issueTicketFromAccessToken).not.toHaveBeenCalled();
  });
});
