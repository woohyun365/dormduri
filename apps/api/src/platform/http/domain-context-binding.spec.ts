import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthActorContextResolver } from '../../auth/application/auth-actor-context.resolver.js';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { AuthenticatedUserGuard } from '../../auth/access/authenticated-user.guard.js';
import { CurrentUser } from '../../auth/access/authenticated-user.decorator.js';
import { RequireCapability } from '../../auth/access/auth-access.decorator.js';
import { MatchesController } from '../../matches/matches.controller.js';
import { MatchesService } from '../../matches/application/matches.service.js';
import {
  ActiveMatchContext,
  RequireActiveMatchParticipant,
} from '../../matches/active/context/active-match-context.decorator.js';
import type { ActiveMatchContext as MatchContext } from '../../matches/active/context/active-match-context.types.js';
import { PrismaService } from '../database/prisma.service.js';
import { ApiExceptionFilter } from './api-exception.filter.js';

// Exposes the real decorator result, including participant mapping not passed to MatchesService.
@Controller('domain-context-probe')
@RequireCapability()
class DomainContextProbeController {
  @Get(':id')
  @RequireActiveMatchParticipant()
  context(
    @CurrentUser() actor: AuthenticatedUserContext,
    @ActiveMatchContext() match: MatchContext,
  ) {
    return { actorUserId: actor.id, match };
  }
}

function actor(id: string): AuthenticatedUserContext {
  return {
    id,
    actorId: id,
    actorType: 'USER',
    sessionId: `session-${id}`,
    gender: 'M',
    campus: 'CHUNCHEON',
    capabilities: [],
  };
}

function activeMatch(id: string, userA: string, userB: string) {
  return {
    id,
    participantAId: `${id}-a`,
    participantBId: `${id}-b`,
    status: 'ACTIVE',
    endedAt: null,
    participantA: { userId: userA },
    participantB: { userId: userB },
  };
}

describe('real Auth -> ActiveMatch -> decorator HTTP binding', () => {
  let app: INestApplication;
  let url: string;
  const actors: Record<string, AuthenticatedUserContext> = {
    'token-a': actor('user-a'),
    'token-b': actor('user-b'),
    'token-c': actor('user-c'),
  };
  const matches = {
    'active-1': activeMatch('active-1', 'user-a', 'user-b'),
    'active-2': activeMatch('active-2', 'user-c', 'user-d'),
  };
  const resolver = { resolveCurrentUserContext: vi.fn() };
  const prisma = { activeMatch: { findUnique: vi.fn() } };
  const service = { requestUnmatch: vi.fn(), cancelUnmatchRequest: vi.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MatchesController, DomainContextProbeController],
      providers: [
        { provide: AuthActorContextResolver, useValue: resolver },
        { provide: PrismaService, useValue: prisma },
        { provide: MatchesService, useValue: service },
        AuthenticatedUserGuard,
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalGuards(module.get(AuthenticatedUserGuard));
    app.useGlobalFilters(
      new ApiExceptionFilter(
        { write: vi.fn() } as never,
        { recordException: vi.fn() } as never,
        module.get(HttpAdapterHost),
      ),
    );
    try {
      await app.listen(0, '127.0.0.1');
      url = await app.getUrl();
    } catch (error) {
      await app.close();
      throw error;
    }
  });
  afterAll(async () => {
    if (app) await app.close();
  });
  beforeEach(() => {
    vi.resetAllMocks();
    resolver.resolveCurrentUserContext.mockImplementation((token: string | null) =>
      token ? (actors[token] ?? null) : null,
    );
    prisma.activeMatch.findUnique.mockImplementation(
      ({ where }: { where: { id: keyof typeof matches } }) =>
        Promise.resolve(matches[where.id] ?? null),
    );
    service.requestUnmatch.mockResolvedValue({ ok: true });
    service.cancelUnmatchRequest.mockResolvedValue({ ok: true });
  });

  const post = (suffix: string, token: string, id = 'active-1') =>
    request(url)
      .post(`/api/matches/active/${id}/unmatch-request${suffix}`)
      .auth(token, { type: 'bearer' });
  const probe = (id: string, token: string) =>
    request(url).get(`/domain-context-probe/${id}`).auth(token, { type: 'bearer' });

  it.each(['', '/cancel'])(
    'participant B reaches the real controller with its own actor and match (%s)',
    async (suffix) => {
      expect((await post(suffix, 'token-b')).status).toBe(201);
      const invoked = suffix ? service.cancelUnmatchRequest : service.requestUnmatch;
      expect(invoked).toHaveBeenCalledExactlyOnceWith(actors['token-b'], 'active-1');
      expect(invoked.mock.calls[0]?.[0]).toBe(actors['token-b']);
      expect(resolver.resolveCurrentUserContext).toHaveBeenCalledTimes(1);
      expect(prisma.activeMatch.findUnique).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ where: { id: 'active-1' } }),
      );
    },
  );

  it('decorator exposes participant B and counterpart mapping from the actual guard', async () => {
    const response = await probe('active-1', 'token-b');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      actorUserId: 'user-b',
      match: {
        activeMatchId: 'active-1',
        actorUserId: 'user-b',
        actorParticipantId: 'active-1-b',
        counterpartParticipantId: 'active-1-a',
        status: 'ACTIVE',
        endedAt: null,
      },
    });
  });

  describe.each([
    { suffix: '', code: 'ACTIVE_MATCH_UNMATCH_REQUEST_NOT_ALLOWED' },
    { suffix: '/cancel', code: 'ACTIVE_MATCH_UNMATCH_REQUEST_CANCEL_NOT_ALLOWED' },
  ])('$code', ({ suffix, code }) => {
    it.each(['nonparticipant', 'inactive', 'ended'])(
      'preserves 409 for %s and performs no service work',
      async (scenario) => {
        if (scenario === 'inactive')
          prisma.activeMatch.findUnique.mockResolvedValue({
            ...matches['active-1'],
            status: 'UNMATCHED',
          });
        if (scenario === 'ended')
          prisma.activeMatch.findUnique.mockResolvedValue({
            ...matches['active-1'],
            endedAt: new Date('2026-01-01T00:00:00Z'),
          });
        const response = await post(suffix, scenario === 'nonparticipant' ? 'token-c' : 'token-b');
        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({ code });
        expect(service.requestUnmatch).not.toHaveBeenCalled();
        expect(service.cancelUnmatchRequest).not.toHaveBeenCalled();
      },
    );

    it('preserves missing-match 404 without service work', async () => {
      const response = await post(suffix, 'token-b', 'missing');
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'ACTIVE_MATCH_NOT_FOUND' });
      expect(service.requestUnmatch).not.toHaveBeenCalled();
      expect(service.cancelUnmatchRequest).not.toHaveBeenCalled();
    });

    it('authentication failure wins before match lookup or service work', async () => {
      const response = await post(suffix, 'invalid-token', 'missing');
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'UNAUTHENTICATED' });
      expect(prisma.activeMatch.findUnique).not.toHaveBeenCalled();
      expect(service.requestUnmatch).not.toHaveBeenCalled();
      expect(service.cancelUnmatchRequest).not.toHaveBeenCalled();
    });
  });

  it('sequential requests do not reuse another actor participant context', async () => {
    for (const [token, userId, participant, counterpart] of [
      ['token-a', 'user-a', 'a', 'b'],
      ['token-b', 'user-b', 'b', 'a'],
      ['token-a', 'user-a', 'a', 'b'],
    ] as const) {
      const response = await probe('active-1', token);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        actorUserId: userId,
        match: {
          actorUserId: userId,
          actorParticipantId: `active-1-${participant}`,
          counterpartParticipantId: `active-1-${counterpart}`,
        },
      });
    }
  });

  it('interleaved async guard lookups keep distinct actors and matches isolated', async () => {
    let releaseFirst!: () => void;
    let enteredFirst!: () => void;
    const released = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      enteredFirst = resolve;
    });
    prisma.activeMatch.findUnique.mockImplementation(
      async ({ where }: { where: { id: keyof typeof matches } }) => {
        if (where.id === 'active-1') {
          enteredFirst();
          await released;
        }
        return matches[where.id];
      },
    );
    const first = probe('active-1', 'token-b')
      .timeout({ deadline: 2000 })
      .then((response) => response);
    try {
      // Await an actual first lookup, not a timing sleep, before issuing the second request.
      await Promise.race([
        entered,
        first.then(() => {
          throw new Error('first request did not reach the guarded lookup');
        }),
      ]);
      const second = await probe('active-2', 'token-c').timeout({ deadline: 2000 });
      expect(second.status).toBe(200);
      expect(second.body).toMatchObject({
        actorUserId: 'user-c',
        match: {
          activeMatchId: 'active-2',
          actorUserId: 'user-c',
          actorParticipantId: 'active-2-a',
          counterpartParticipantId: 'active-2-b',
        },
      });
    } finally {
      releaseFirst();
      await first;
    }
    const response = await first;
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      actorUserId: 'user-b',
      match: {
        activeMatchId: 'active-1',
        actorUserId: 'user-b',
        actorParticipantId: 'active-1-b',
        counterpartParticipantId: 'active-1-a',
      },
    });
  });
});
