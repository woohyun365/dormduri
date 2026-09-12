import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ActiveMatchContextGuard } from './active-match-context.guard.js';
import { RequireActiveMatchParticipant } from './active-match-context.decorator.js';
import type { ActiveMatchContextRequest } from './active-match-context.types.js';

class ActiveMatchContextGuardFixtureController {
  @RequireActiveMatchParticipant()
  activeMatchRoute(this: void) {
    return 'active-match';
  }

  @RequireActiveMatchParticipant('unmatch-cancel-not-allowed')
  activeMatchCancelRoute(this: void) {
    return 'active-match-cancel';
  }

  noDomainContextRoute(this: void) {
    return 'read';
  }
}

function makeExecutionContext(
  handlerName: keyof ActiveMatchContextGuardFixtureController,
  request: Partial<ActiveMatchContextRequest> = {},
): ExecutionContext {
  const httpRequest = request as ActiveMatchContextRequest;
  httpRequest.headers ??= {};
  httpRequest.params ??= {};

  return {
    getClass: () => ActiveMatchContextGuardFixtureController,
    getHandler: () => ActiveMatchContextGuardFixtureController.prototype[handlerName],
    switchToHttp: () => ({
      getRequest: () => httpRequest,
    }),
  } as unknown as ExecutionContext;
}

function makeActiveMatch(
  overrides: Partial<{
    id: string;
    participantAId: string;
    participantBId: string;
    status: 'ACTIVE' | 'UNMATCHED';
    endedAt: Date | null;
    participantA: { userId: string };
    participantB: { userId: string };
  }> = {},
) {
  return {
    id: 'active-1',
    participantAId: 'participant-1',
    participantBId: 'participant-2',
    status: 'ACTIVE' as const,
    endedAt: null,
    participantA: { userId: 'user-1' },
    participantB: { userId: 'user-2' },
    ...overrides,
  };
}

function makeActorRequest(
  overrides: Partial<ActiveMatchContextRequest> = {},
): Partial<ActiveMatchContextRequest> {
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
    params: { id: 'active-1' },
    ...overrides,
  };
}

describe('ActiveMatchContextGuard', () => {
  const prisma = {
    activeMatch: {
      findUnique: vi.fn(),
    },
  };
  const guard = new ActiveMatchContextGuard(prisma as never, new Reflector());

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.activeMatch.findUnique.mockResolvedValue(makeActiveMatch());
  });

  it('domain context metadata가 없는 route는 추가 조회 없이 통과한다', async () => {
    await expect(guard.canActivate(makeExecutionContext('noDomainContextRoute'))).resolves.toBe(
      true,
    );

    expect(prisma.activeMatch.findUnique).not.toHaveBeenCalled();
  });

  it('valid active match participant는 request-scoped active match context로 고정한다', async () => {
    const request = makeActorRequest();

    await expect(
      guard.canActivate(makeExecutionContext('activeMatchRoute', request)),
    ).resolves.toBe(true);

    expect(prisma.activeMatch.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'active-1' },
      }),
    );
    expect(request.domainContexts?.activeMatch).toMatchObject({
      activeMatchId: 'active-1',
      actorUserId: 'user-1',
      actorParticipantId: 'participant-1',
      counterpartParticipantId: 'participant-2',
      status: 'ACTIVE',
      endedAt: null,
    });
  });

  it('auth actor context가 없으면 fail-closed 처리한다', async () => {
    await expect(
      guard.canActivate(makeExecutionContext('activeMatchRoute', { params: { id: 'active-1' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.activeMatch.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['missing active match id', {}],
    ['empty active match id', { id: '   ' }],
    ['array active match id', { id: ['value'] }],
    ['non-string active match id', { id: 123 }],
  ])('%s는 bad request로 거절한다', async (_label, params) => {
    await expect(
      guard.canActivate(makeExecutionContext('activeMatchRoute', makeActorRequest({ params }))),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.activeMatch.findUnique).not.toHaveBeenCalled();
  });

  it('active match가 없으면 not found로 fail-closed 처리한다', async () => {
    prisma.activeMatch.findUnique.mockResolvedValue(null);

    await expect(
      guard.canActivate(makeExecutionContext('activeMatchRoute', makeActorRequest())),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    ['ended match', makeActiveMatch({ endedAt: new Date('2026-06-03T00:00:00.000Z') })],
    ['non-active match', makeActiveMatch({ status: 'UNMATCHED' })],
    [
      'non participant actor',
      makeActiveMatch({
        participantA: { userId: 'other-1' },
        participantB: { userId: 'other-2' },
      }),
    ],
  ])('%s는 unmatch action 전 coarse fail-closed 처리한다', async (_label, activeMatch) => {
    prisma.activeMatch.findUnique.mockResolvedValue(activeMatch);

    await expect(
      guard.canActivate(makeExecutionContext('activeMatchRoute', makeActorRequest())),
    ).rejects.toBeInstanceOf(ConflictException);

    await expect(
      guard.canActivate(makeExecutionContext('activeMatchRoute', makeActorRequest())),
    ).rejects.toMatchObject({
      response: { code: 'ACTIVE_MATCH_UNMATCH_REQUEST_NOT_ALLOWED' },
    });
  });

  it('cancel route는 기존 cancel-specific error contract로 coarse fail-closed 처리한다', async () => {
    prisma.activeMatch.findUnique.mockResolvedValue(
      makeActiveMatch({
        participantA: { userId: 'other-1' },
        participantB: { userId: 'other-2' },
      }),
    );

    await expect(
      guard.canActivate(makeExecutionContext('activeMatchCancelRoute', makeActorRequest())),
    ).rejects.toMatchObject({
      response: { code: 'ACTIVE_MATCH_UNMATCH_REQUEST_CANCEL_NOT_ALLOWED' },
    });
  });

  it.each([
    ['ended match', makeActiveMatch({ endedAt: new Date('2026-06-03T00:00:00.000Z') })],
    ['non-active match', makeActiveMatch({ status: 'UNMATCHED' })],
  ])(
    'cancel route의 %s도 cancel-specific error contract를 유지한다',
    async (_label, activeMatch) => {
      prisma.activeMatch.findUnique.mockResolvedValue(activeMatch);

      await expect(
        guard.canActivate(makeExecutionContext('activeMatchCancelRoute', makeActorRequest())),
      ).rejects.toMatchObject({
        response: { code: 'ACTIVE_MATCH_UNMATCH_REQUEST_CANCEL_NOT_ALLOWED' },
      });
    },
  );
});
