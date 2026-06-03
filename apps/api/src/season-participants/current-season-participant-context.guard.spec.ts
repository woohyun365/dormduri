import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequireCurrentSeasonParticipant } from './current-season-participant-context.decorator.js';
import { CurrentSeasonParticipantContextGuard } from './current-season-participant-context.guard.js';
import type { CurrentSeasonParticipantContextRequest } from './current-season-participant-context.types.js';
import type { CurrentSeasonParticipantRecord } from './season-participants.service.js';

class DomainContextGuardFixtureController {
  @RequireCurrentSeasonParticipant()
  mutationRoute() {
    return 'mutation';
  }

  noDomainContextRoute() {
    return 'read';
  }
}

function makeExecutionContext(
  handlerName: keyof DomainContextGuardFixtureController,
  request: Partial<CurrentSeasonParticipantContextRequest> = {},
): ExecutionContext {
  const httpRequest = request as CurrentSeasonParticipantContextRequest;
  httpRequest.headers ??= {};

  return {
    getClass: () => DomainContextGuardFixtureController,
    getHandler: () => DomainContextGuardFixtureController.prototype[handlerName],
    switchToHttp: () => ({
      getRequest: () => httpRequest,
    }),
  } as unknown as ExecutionContext;
}

function makeParticipant(
  overrides: Partial<CurrentSeasonParticipantRecord> = {},
): CurrentSeasonParticipantRecord {
  const now = new Date('2026-06-03T00:00:00.000Z');
  return {
    id: 'participant-1',
    seasonId: 'season-1',
    userId: 'user-1',
    participationIntent: 'UNDECIDED',
    registeredAt: null,
    declinedAt: null,
    dormitoryId: null,
    dormitorySelectionState: 'NOT_SELECTED',
    participantStatus: 'NOT_STARTED',
    campusCodeSnapshot: 'CHUNCHEON',
    genderSnapshot: 'M',
    joinedAt: now,
    activatedAt: null,
    matchedAt: null,
    withdrawnAt: null,
    expiredAt: null,
    hiddenByAdminAt: null,
    hiddenReasonCode: null,
    hiddenReasonDetail: null,
    deactivatedAt: null,
    createdAt: now,
    updatedAt: now,
    profile: null,
    ...overrides,
  };
}

describe('CurrentSeasonParticipantContextGuard', () => {
  const databaseNow = new Date('2026-06-03T01:02:03.000Z');
  const user = {
    id: 'user-1',
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
  };
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    getDatabaseNow: jest.fn(),
  };
  const seasonParticipantsService = {
    ensureCurrentSeasonParticipant: jest.fn(),
  };
  const guard = new CurrentSeasonParticipantContextGuard(
    prisma as never,
    seasonParticipantsService as never,
    new Reflector(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.getDatabaseNow.mockResolvedValue(databaseNow);
    seasonParticipantsService.ensureCurrentSeasonParticipant.mockResolvedValue(makeParticipant());
  });

  it('domain context metadata가 없는 route는 추가 조회 없이 통과한다', async () => {
    await expect(guard.canActivate(makeExecutionContext('noDomainContextRoute'))).resolves.toBe(
      true,
    );

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(seasonParticipantsService.ensureCurrentSeasonParticipant).not.toHaveBeenCalled();
  });

  it('current-season-participant context를 준비해 request에 고정한다', async () => {
    const participant = makeParticipant({ id: 'participant-ctx' });
    seasonParticipantsService.ensureCurrentSeasonParticipant.mockResolvedValue(participant);
    const request: Partial<CurrentSeasonParticipantContextRequest> = {
      authUser: {
        id: 'user-1',
        sessionId: 'session-1',
        actorType: 'USER',
        actorId: 'user-1',
        gender: 'M',
        campus: 'CHUNCHEON',
        capabilities: [],
      },
    };

    await expect(guard.canActivate(makeExecutionContext('mutationRoute', request))).resolves.toBe(
      true,
    );

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: {
        id: true,
        emailVerifiedAt: true,
        deletedAt: true,
        gender: true,
        campus: true,
      },
    });
    expect(prisma.getDatabaseNow).toHaveBeenCalledTimes(1);
    expect(seasonParticipantsService.ensureCurrentSeasonParticipant).toHaveBeenCalledWith(
      user,
      databaseNow,
    );
    expect(request.domainContexts?.currentSeasonParticipant).toBe(participant);
  });

  it('auth guard가 actor context를 준비하지 않았으면 fail-closed 처리한다', async () => {
    await expect(guard.canActivate(makeExecutionContext('mutationRoute'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['missing user', null],
    ['unverified user', { ...user, emailVerifiedAt: null }],
    ['deleted user', { ...user, deletedAt: new Date('2026-01-02T00:00:00.000Z') }],
  ])('%s는 participant context를 만들지 않고 fail-closed 처리한다', async (_label, dbUser) => {
    prisma.user.findUnique.mockResolvedValue(dbUser);

    await expect(
      guard.canActivate(
        makeExecutionContext('mutationRoute', {
          authUser: {
            id: 'user-1',
            gender: 'M',
            campus: 'CHUNCHEON',
            sessionId: 'session-1',
            actorType: 'USER',
            actorId: 'user-1',
            capabilities: [],
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(seasonParticipantsService.ensureCurrentSeasonParticipant).not.toHaveBeenCalled();
  });

  it('current season participant ensure가 실패하면 fail-closed 처리한다', async () => {
    seasonParticipantsService.ensureCurrentSeasonParticipant.mockResolvedValue(null);

    await expect(
      guard.canActivate(
        makeExecutionContext('mutationRoute', {
          authUser: {
            id: 'user-1',
            gender: 'M',
            campus: 'CHUNCHEON',
            sessionId: 'session-1',
            actorType: 'USER',
            actorId: 'user-1',
            capabilities: [],
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
