import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthActorContextResolver } from '../../auth/application/auth-actor-context.resolver.js';
import { AuthenticatedUserGuard } from '../../auth/access/authenticated-user.guard.js';
import { ChatController } from '../../chat/chat.controller.js';
import { ChatService } from '../../chat/application/chat.service.js';
import { ChatThreadContextResolver } from '../../chat/context/chat-thread-context.resolver.js';
import { ChatRealtimeTicketService } from '../../chat/realtime/chat-realtime-ticket.service.js';
import { ChatRealtimeRateLimiterService } from '../../chat/realtime/chat-realtime-rate-limiter.service.js';
import { ChatRealtimeMetricsService } from '../../chat/realtime/chat-realtime.metrics.js';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { createHttpAdapter } from './http-adapter.js';

describe('authenticated chat query binding', () => {
  let app: INestApplication;
  let url: string;
  const actor = { id: 'user-query', capabilities: [] };
  const resolver = { resolveCurrentUserContext: vi.fn() };
  const chat = { listThreads: vi.fn(), replayRealtimeEvents: vi.fn() };
  const metrics = { recordReplayResyncRequired: vi.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        { provide: AuthActorContextResolver, useValue: resolver },
        { provide: ChatService, useValue: chat },
        { provide: ChatThreadContextResolver, useValue: {} },
        { provide: ChatRealtimeTicketService, useValue: {} },
        { provide: ChatRealtimeRateLimiterService, useValue: {} },
        { provide: ChatRealtimeMetricsService, useValue: metrics },
        AuthenticatedUserGuard,
      ],
    }).compile();
    app = module.createNestApplication(createHttpAdapter(false), { logger: false });
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
      token === 'valid-query-token' ? actor : null,
    );
    chat.listThreads.mockResolvedValue({ items: [] });
    chat.replayRealtimeEvents.mockResolvedValue({ ok: true, events: [] });
  });

  function expectNoSideEffects() {
    expect(chat.listThreads).not.toHaveBeenCalled();
    expect(chat.replayRealtimeEvents).not.toHaveBeenCalled();
    expect(metrics.recordReplayResyncRequired).not.toHaveBeenCalled();
  }

  describe.each([
    {
      path: '/api/chat/threads',
      field: 'cursor',
      service: chat.listThreads,
      defaultLimit: undefined,
      maxLimit: 50,
    },
    {
      path: '/api/chat/realtime/replay',
      field: 'after',
      service: chat.replayRealtimeEvents,
      defaultLimit: 100,
      maxLimit: 100,
    },
  ])('$field query', ({ path, field, service, defaultLimit, maxLimit }) => {
    const send = (query: string) =>
      request(url).get(`${path}${query}`).auth('valid-query-token', { type: 'bearer' });

    it.each(['a', ''])(
      'repeated values (%s) return controlled 400 before service work',
      async (value) => {
        const response = await send(`?${field}=${value}&${field}=b`);
        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          code: 'INVALID_QUERY',
          fieldErrors: { [field]: [`${field} must be a single string`] },
        });
        expectNoSideEffects();
      },
    );

    it.each([
      { query: '', parsed: null },
      { query: '=', parsed: null },
      { query: '=%20%20', parsed: null },
      { query: '=%20cursor-1%20', parsed: 'cursor-1' },
    ])('preserves absent/empty/trimmed values $query', async ({ query, parsed }) => {
      const response = await send(query ? `?${field}${query}` : '');
      expect(response.status).toBe(200);
      expect(service).toHaveBeenCalledExactlyOnceWith(actor, {
        [field]: parsed,
        limit: defaultLimit,
      });
    });

    it.each(['1', ' 2 ', '02'])(
      'preserves existing Number coercion for limit=%s',
      async (limit) => {
        expect((await send(`?limit=${encodeURIComponent(limit)}`)).status).toBe(200);
        expect(service).toHaveBeenCalledExactlyOnceWith(actor, {
          [field]: null,
          limit: Number(limit),
        });
      },
    );

    it('accepts the upper limit and rejects out-of-range/repeated limits', async () => {
      expect((await send(`?limit=${maxLimit}`)).status).toBe(200);
      expect(service).toHaveBeenCalledExactlyOnceWith(actor, { [field]: null, limit: maxLimit });
      service.mockClear();
      for (const query of [
        '?limit=0',
        '?limit=1.5',
        '?limit=no',
        `?limit=${maxLimit + 1}`,
        '?limit=1&limit=2',
      ]) {
        const response = await send(query);
        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          code: 'INVALID_QUERY',
          fieldErrors: { limit: [`limit must be an integer between 1 and ${maxLimit}`] },
        });
        expectNoSideEffects();
      }
    });

    it('keeps its current first-error order for multiple invalid query fields', async () => {
      const response = await send(`?${field}=a&${field}=b&limit=no`);
      const first = field === 'cursor' ? 'limit' : 'after';
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'INVALID_QUERY',
        fieldErrors: {
          [first]: [
            first === 'limit'
              ? 'limit must be an integer between 1 and 50'
              : 'after must be a single string',
          ],
        },
      });
      expectNoSideEffects();
    });

    it('rejects unauthenticated malformed query before handler work', async () => {
      const response = await request(url).get(`${path}?${field}=a&${field}=b&limit=no`);
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'UNAUTHENTICATED' });
      expectNoSideEffects();
    });
  });
});
