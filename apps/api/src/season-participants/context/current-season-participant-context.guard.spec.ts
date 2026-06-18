import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequireCurrentSeasonParticipant } from './current-season-participant-context.decorator.js';
import { CurrentSeasonParticipantContextGuard } from './current-season-participant-context.guard.js';
import type { CurrentSeasonParticipantContextRequest } from './current-season-participant-context.types.js';
import type { CurrentSeasonParticipantRecord } from '../application/season-participants.service.js';

class DomainContextGuardFixtureController {
  @RequireCurrentSeasonParticipant()
  mutationRoute() {
    return 'mutation';
  }

  @RequireCurrentSeasonParticipant('season-profile-draft-not-allowed')
  profileDraftRoute() {
    return 'profile-draft';
  }

  @RequireCurrentSeasonParticipant('registration-not-allowed')
  registrationRoute() {
    return 'registration';
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
  const resolver = {
    resolveForActor: vi.fn(),
  };
  const guard = new CurrentSeasonParticipantContextGuard(resolver as never, new Reflector());

  beforeEach(() => {
    vi.clearAllMocks();
    resolver.resolveForActor.mockResolvedValue(makeParticipant());
  });

  it('domain context metadata가 없는 route는 추가 조회 없이 통과한다', async () => {
    await expect(guard.canActivate(makeExecutionContext('noDomainContextRoute'))).resolves.toBe(
      true,
    );

    expect(resolver.resolveForActor).not.toHaveBeenCalled();
  });

  it('current-season-participant context를 준비해 request에 고정한다', async () => {
    const participant = makeParticipant({ id: 'participant-ctx' });
    resolver.resolveForActor.mockResolvedValue(participant);
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

    expect(resolver.resolveForActor).toHaveBeenCalledWith({
      actorUserId: 'user-1',
      requirement: {
        kind: 'current-season-participant',
        mode: 'ensure',
        source: 'actor-campus',
        failure: 'context-required',
      },
    });
    expect(request.domainContexts?.currentSeasonParticipant).toBe(participant);
  });

  it('auth guard가 actor context를 준비하지 않았으면 fail-closed 처리한다', async () => {
    await expect(guard.canActivate(makeExecutionContext('mutationRoute'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(resolver.resolveForActor).not.toHaveBeenCalled();
  });

  it('default route는 current season participant ensure 실패를 context-required로 fail-closed 처리한다', async () => {
    resolver.resolveForActor.mockResolvedValue(null);

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

  it('profile/dormitory route는 ensure 실패 시 기존 profile draft error code를 유지한다', async () => {
    resolver.resolveForActor.mockResolvedValue(null);

    await expect(
      guard.canActivate(
        makeExecutionContext('profileDraftRoute', {
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
    ).rejects.toMatchObject({
      response: { code: 'SEASON_PROFILE_DRAFT_NOT_ALLOWED' },
    });
  });

  it('registration route는 ensure 실패 시 기존 registration error code를 유지한다', async () => {
    resolver.resolveForActor.mockResolvedValue(null);

    await expect(
      guard.canActivate(
        makeExecutionContext('registrationRoute', {
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
    ).rejects.toMatchObject({
      response: { code: 'SEASON_PARTICIPATION_REGISTRATION_NOT_ALLOWED' },
    });
  });
});
