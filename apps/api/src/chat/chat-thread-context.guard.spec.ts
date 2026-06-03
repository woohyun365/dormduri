import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ChatThreadContextGuard } from './chat-thread-context.guard.js';
import { RequireChatThreadMember } from './chat-thread-context.decorator.js';
import type { ChatThreadContextRequest } from './chat-thread-context.types.js';

function objectContaining(shape: Record<string, unknown>): unknown {
  return expect.objectContaining(shape) as unknown;
}

class ChatThreadContextGuardFixtureController {
  @RequireChatThreadMember()
  threadRoute() {
    return 'thread';
  }

  noDomainContextRoute() {
    return 'read';
  }
}

function makeExecutionContext(
  handlerName: keyof ChatThreadContextGuardFixtureController,
  request: Partial<ChatThreadContextRequest> = {},
): ExecutionContext {
  const httpRequest = request as ChatThreadContextRequest;
  httpRequest.headers ??= {};
  httpRequest.params ??= {};

  return {
    getClass: () => ChatThreadContextGuardFixtureController,
    getHandler: () => ChatThreadContextGuardFixtureController.prototype[handlerName],
    switchToHttp: () => ({
      getRequest: () => httpRequest,
    }),
  } as unknown as ExecutionContext;
}

function makeThread() {
  const now = new Date('2026-06-03T00:00:00.000Z');
  return {
    id: 'thread-1',
    status: 'OPEN' as const,
    closedAt: null,
    closedReason: null,
    members: [
      {
        participantId: 'participant-1',
        memberState: 'ACTIVE' as const,
        lastVisibleAt: now,
        participant: {
          userId: 'user-1',
        },
      },
    ],
  };
}

function makeActorRequest(
  overrides: Partial<ChatThreadContextRequest> = {},
): Partial<ChatThreadContextRequest> {
  return {
    authUser: {
      id: 'user-1',
      sessionId: 'session-1',
      actorType: 'USER',
      actorId: 'user-1',
      gender: 'M',
      campus: 'CHUNCHEON',
      capabilities: [],
    },
    params: { threadId: 'thread-1' },
    ...overrides,
  };
}

describe('ChatThreadContextGuard', () => {
  const prisma = {
    conversationThread: {
      findFirst: jest.fn(),
    },
  };
  const guard = new ChatThreadContextGuard(prisma as never, new Reflector());

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.conversationThread.findFirst.mockResolvedValue(makeThread());
  });

  it('domain context metadata가 없는 route는 추가 조회 없이 통과한다', async () => {
    await expect(guard.canActivate(makeExecutionContext('noDomainContextRoute'))).resolves.toBe(
      true,
    );

    expect(prisma.conversationThread.findFirst).not.toHaveBeenCalled();
  });

  it('valid active thread member는 request-scoped chat thread context로 고정한다', async () => {
    const request = makeActorRequest();

    await expect(guard.canActivate(makeExecutionContext('threadRoute', request))).resolves.toBe(
      true,
    );

    expect(prisma.conversationThread.findFirst).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({
          id: 'thread-1',
          status: { in: ['OPEN', 'READ_ONLY'] },
          members: objectContaining({
            some: objectContaining({
              memberState: 'ACTIVE',
              participant: objectContaining({
                userId: 'user-1',
              }),
            }),
          }),
        }),
      }),
    );
    expect(request.domainContexts?.chatThread).toMatchObject({
      threadId: 'thread-1',
      actorUserId: 'user-1',
      actorParticipantId: 'participant-1',
      memberState: 'ACTIVE',
      threadStatus: 'OPEN',
    });
  });

  it('auth actor context가 없으면 fail-closed 처리한다', async () => {
    await expect(
      guard.canActivate(makeExecutionContext('threadRoute', { params: { threadId: 'thread-1' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.conversationThread.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ['missing threadId', {}],
    ['empty threadId', { threadId: '   ' }],
  ])('%s는 bad request로 거절한다', async (_label, params) => {
    await expect(
      guard.canActivate(makeExecutionContext('threadRoute', makeActorRequest({ params }))),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.conversationThread.findFirst).not.toHaveBeenCalled();
  });

  it('non-member/hidden/archived thread는 context를 만들지 않고 fail-closed 처리한다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue(null);

    await expect(
      guard.canActivate(makeExecutionContext('threadRoute', makeActorRequest())),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(makeActorRequest()).not.toHaveProperty('domainContexts');
  });

  it('조회 결과에 active actor member가 없으면 fail-closed 처리한다', async () => {
    prisma.conversationThread.findFirst.mockResolvedValue({
      ...makeThread(),
      members: [],
    });

    await expect(
      guard.canActivate(makeExecutionContext('threadRoute', makeActorRequest())),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
