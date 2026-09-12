import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AUTH_ACCESS_METADATA_KEY } from '../auth/access/auth-access.decorator.js';
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
    listThreads: vi.fn(),
    getConversationStats: vi.fn(),
    getThreadEntry: vi.fn(),
    getThreadDetail: vi.fn(),
    leaveThread: vi.fn(),
    updateReadMarker: vi.fn(),
    replayRealtimeEvents: vi.fn(),
    sendMessage: vi.fn(),
  };
  const realtimeTicketService = {
    issueTicketFromAccessToken: vi.fn(),
  };
  const rateLimiter = {
    consumeMessageSend: vi.fn(),
    consumeRealtimeTicket: vi.fn(),
  };
  const metrics = {
    recordRateLimitRejection: vi.fn(),
    recordReplayResyncRequired: vi.fn(),
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
    vi.clearAllMocks();
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
    const response = await expectBadRequest(() => controller.getThreads(authUser, '51'));

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

  it('유효한 메시지 전송 요청은 clientMessageId를 service로 전달한다', async () => {
    chatService.sendMessage.mockResolvedValueOnce({
      thread: { id: 'thread-1' },
      message: { id: 'message-1' },
      createdThread: false,
    });

    await expect(
      controller.sendMessage(authUser as never, {
        targetUserId: 'user-2',
        body: '안녕하세요',
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

  it('thread detail은 chat thread context가 있으면 actor/param 일치 후 service로 위임한다', async () => {
    chatService.getThreadDetail.mockResolvedValueOnce({
      thread: { id: 'thread-1' },
      messages: [],
    });

    await expect(
      controller.getThreadDetail(authUser as never, 'thread-1', {
        threadId: 'thread-1',
        actorUserId: 'user-1',
      } as never),
    ).resolves.toEqual({
      thread: { id: 'thread-1' },
      messages: [],
    });

    expect(chatService.getThreadDetail).toHaveBeenCalledWith(authUser, 'thread-1');
  });

  it('thread detail은 chat thread context와 auth actor가 다르면 fail-closed 처리한다', async () => {
    await expect(
      controller.getThreadDetail(authUser as never, 'thread-1', {
        threadId: 'thread-1',
        actorUserId: 'other-user',
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(chatService.getThreadDetail).not.toHaveBeenCalled();
  });

  it('thread detail은 chat thread context와 route param이 다르면 fail-closed 처리한다', async () => {
    await expect(
      controller.getThreadDetail(authUser as never, 'thread-1', {
        threadId: 'thread-2',
        actorUserId: 'user-1',
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(chatService.getThreadDetail).not.toHaveBeenCalled();
  });

  it('leaveThread는 controller guard 대상이 아니며 service error contract에 위임한다', async () => {
    chatService.leaveThread.mockResolvedValueOnce({
      threadId: 'thread-1',
      archived: false,
    });

    await expect(controller.leaveThread(authUser as never, 'thread-1')).resolves.toEqual({
      threadId: 'thread-1',
      archived: false,
    });

    expect(chatService.leaveThread).toHaveBeenCalledWith(authUser, 'thread-1');
  });

  it('유효한 read marker 갱신 요청은 service로 전달한다', async () => {
    chatService.updateReadMarker.mockResolvedValueOnce({
      threadId: 'thread-1',
      lastReadMessageId: 'message-1',
      lastReadAt: '2026-02-10T03:00:00.000Z',
    });

    await expect(
      controller.updateReadMarker(
        authUser as never,
        'thread-1',
        {
          lastReadMessageId: 'message-1',
        },
        {
          threadId: 'thread-1',
          actorUserId: 'user-1',
        } as never,
      ),
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
      controller.replayRealtimeEvents(authUser, undefined, '101'),
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
      controller.issueRealtimeTicket(authUser as never, 'Bearer access-token-1', '203.0.113.20'),
    ).resolves.toEqual({
      ticket: 'ticket-1',
      scope: 'chat:realtime',
      expiresAt: '2026-02-10T03:01:00.000Z',
    });

    expect(rateLimiter.consumeRealtimeTicket).toHaveBeenCalledWith({
      userId: 'user-1',
      ip: '203.0.113.20',
    });
    expect(realtimeTicketService.issueTicketFromAccessToken).toHaveBeenCalledWith('access-token-1');
  });

  it('realtime ticket 발급 실패는 unauthenticated로 거절한다', async () => {
    realtimeTicketService.issueTicketFromAccessToken.mockResolvedValueOnce(null);

    await expect(
      controller.issueRealtimeTicket(authUser as never, undefined, 'unknown'),
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
      controller.issueRealtimeTicket(authUser as never, 'Bearer access-token-1', 'unknown'),
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
