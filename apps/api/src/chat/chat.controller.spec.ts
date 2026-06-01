import { BadRequestException } from '@nestjs/common';
import { AuthenticatedUserGuard } from '../auth/authenticated-user.guard.js';
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
    getThreadEntry: jest.fn(),
    getThreadDetail: jest.fn(),
    leaveThread: jest.fn(),
    updateReadMarker: jest.fn(),
    replayRealtimeEvents: jest.fn(),
    sendMessage: jest.fn(),
  };

  const controller = new ChatController(chatService as never);
  const authUser = {
    id: 'user-1',
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('controller class는 AuthenticatedUserGuard로 보호된다', () => {
    const guards = Reflect.getMetadata('__guards__', ChatController) as Array<unknown> | undefined;
    expect(guards).toBeDefined();
    expect(guards).toContain(AuthenticatedUserGuard);
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

    expect(chatService.sendMessage).toHaveBeenCalledWith(
      authUser,
      expect.objectContaining({
        targetUserId: 'user-2',
        body: '안녕하세요',
        clientMessageId: 'client-message-1',
      }),
    );
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
  });

  it('replay limit이 허용 범위를 벗어나면 bad request로 거절한다', async () => {
    const response = await expectBadRequest(() =>
      controller.replayRealtimeEvents(authUser as never, undefined, '101'),
    );

    expect(response.code).toBe('INVALID_QUERY');
    expect(response.fieldErrors?.limit).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(chatService.replayRealtimeEvents).not.toHaveBeenCalled();
  });
});
