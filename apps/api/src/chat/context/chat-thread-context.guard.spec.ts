import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequireChatThreadMember } from './chat-thread-context.decorator.js';
import { ChatThreadContextGuard } from './chat-thread-context.guard.js';
import type { ChatThreadContextResolver } from './chat-thread-context.resolver.js';
import type { ChatThreadContext, ChatThreadContextRequest } from './chat-thread-context.types.js';

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

function makeChatThreadContext(): ChatThreadContext {
  return {
    threadId: 'thread-1',
    actorUserId: 'user-1',
    actorParticipantId: 'participant-1',
    memberState: 'ACTIVE',
    threadStatus: 'OPEN',
    closedAt: null,
    closedReason: null,
    lastVisibleAt: new Date('2026-06-03T00:00:00.000Z'),
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
  const resolver = {
    resolveVisibleActiveMemberContext: vi.fn(),
  } satisfies Pick<ChatThreadContextResolver, 'resolveVisibleActiveMemberContext'>;
  const guard = new ChatThreadContextGuard(
    resolver as unknown as ChatThreadContextResolver,
    new Reflector(),
  );

  beforeEach(() => {
    vi.clearAllMocks();
    resolver.resolveVisibleActiveMemberContext.mockResolvedValue(makeChatThreadContext());
  });

  it('domain context metadata가 없는 route는 resolver 조회 없이 통과한다', async () => {
    await expect(guard.canActivate(makeExecutionContext('noDomainContextRoute'))).resolves.toBe(
      true,
    );

    expect(resolver.resolveVisibleActiveMemberContext).not.toHaveBeenCalled();
  });

  it('valid active thread member는 request-scoped chat thread context로 고정한다', async () => {
    const request = makeActorRequest();

    await expect(guard.canActivate(makeExecutionContext('threadRoute', request))).resolves.toBe(
      true,
    );

    expect(resolver.resolveVisibleActiveMemberContext).toHaveBeenCalledWith({
      actorUserId: 'user-1',
      threadId: 'thread-1',
    });
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

    expect(resolver.resolveVisibleActiveMemberContext).not.toHaveBeenCalled();
  });

  it.each([
    ['missing threadId', {}],
    ['empty threadId', { threadId: '   ' }],
  ])('%s는 bad request로 거절한다', async (_label, params) => {
    await expect(
      guard.canActivate(makeExecutionContext('threadRoute', makeActorRequest({ params }))),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(resolver.resolveVisibleActiveMemberContext).not.toHaveBeenCalled();
  });

  it('non-member/hidden/archived thread는 context를 만들지 않고 fail-closed 처리한다', async () => {
    const request = makeActorRequest();
    resolver.resolveVisibleActiveMemberContext.mockResolvedValue(null);

    await expect(
      guard.canActivate(makeExecutionContext('threadRoute', request)),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(request).not.toHaveProperty('domainContexts');
  });
});
