import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../../auth/auth.controller.js';
import { AuthService } from '../../auth/application/auth.service.js';
import { AuthActorContextResolver } from '../../auth/application/auth-actor-context.resolver.js';
import { AuthenticatedUserGuard } from '../../auth/access/authenticated-user.guard.js';
import { ChatController } from '../../chat/chat.controller.js';
import { ChatService } from '../../chat/application/chat.service.js';
import { ChatThreadContextResolver } from '../../chat/context/chat-thread-context.resolver.js';
import { ChatRealtimeTicketService } from '../../chat/realtime/chat-realtime-ticket.service.js';
import { ChatRealtimeRateLimiterService } from '../../chat/realtime/chat-realtime-rate-limiter.service.js';
import { ChatRealtimeMetricsService } from '../../chat/realtime/chat-realtime.metrics.js';
import chatRealtimeConfig from '../../chat/realtime/chat-realtime.config.js';
import { ApiExceptionFilter } from './api-exception.filter.js';

const actor = {
  id: 'user-1',
  actorId: 'user-1',
  actorType: 'USER',
  sessionId: 'session-1',
  campus: 'CHUNCHEON',
  gender: 'M',
  capabilities: ['auth:password:change:self'],
};
const forwardedIp = '203.0.113.10';
const realIp = '203.0.113.20';
const localIp = '127.0.0.1';

// HTTP trust-proxy and chat realtime trust-proxy are independent existing policies.
describe.each([
  { httpTrust: false, chatTrust: false },
  { httpTrust: false, chatTrust: true },
  { httpTrust: true, chatTrust: false },
  { httpTrust: true, chatTrust: true },
])('request context binding: %j', ({ httpTrust, chatTrust }) => {
  let app: INestApplication;
  let url: string;
  const auth = { login: vi.fn(), getSession: vi.fn(), changePassword: vi.fn(), logout: vi.fn() };
  const resolver = { resolveCurrentUserContext: vi.fn() };
  const tickets = { issueTicketFromAccessToken: vi.fn() };
  const metrics = { recordRateLimitRejection: vi.fn() };
  let consumeTicket: MockInstance<ChatRealtimeRateLimiterService['consumeRealtimeTicket']>;
  const limiter = new ChatRealtimeRateLimiterService({
    ...chatRealtimeConfig(),
    trustProxy: chatTrust,
    ticketUserLimit: 1,
    ticketUserWindowMs: 60_000,
    ticketIpLimit: 10,
    ticketIpWindowMs: 60_000,
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController, ChatController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: AuthActorContextResolver, useValue: resolver },
        { provide: ChatService, useValue: {} },
        { provide: ChatThreadContextResolver, useValue: {} },
        { provide: ChatRealtimeTicketService, useValue: tickets },
        { provide: ChatRealtimeRateLimiterService, useValue: limiter },
        { provide: ChatRealtimeMetricsService, useValue: metrics },
        AuthenticatedUserGuard,
        Reflector,
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    const server = app.getHttpAdapter().getInstance() as {
      set(name: string, value: boolean): void;
    };
    server.set('trust proxy', httpTrust);
    app.useGlobalGuards(module.get(AuthenticatedUserGuard));
    app.useGlobalFilters(
      new ApiExceptionFilter(
        { write: vi.fn() } as never,
        { recordException: vi.fn() } as never,
        module.get(HttpAdapterHost),
      ),
    );
    await app.listen(0, localIp);
    url = await app.getUrl();
  });
  afterAll(async () => {
    if (app) await app.close();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    consumeTicket = vi.spyOn(limiter, 'consumeRealtimeTicket');
    limiter.resetForTest();
    limiter.setClockForTest(() => 1_000);
    resolver.resolveCurrentUserContext.mockImplementation((token: string | null) =>
      token === 'valid-token' ? actor : null,
    );
    for (const method of Object.values(auth)) method.mockResolvedValue({ success: true });
    tickets.issueTicketFromAccessToken.mockResolvedValue({ ticket: 'ticket-1' });
  });

  it('public login forwards HTTP IP and user-agent without resolving an actor', async () => {
    const response = await request(url)
      .post('/auth/login')
      .set('x-forwarded-for', `${forwardedIp}, 10.0.0.1`)
      .set('x-real-ip', realIp)
      .set('user-agent', 'context-test')
      .send({ email: 'TEST@kangwon.ac.kr', password: 'Test1234' });
    expect(response.status).toBe(200);
    expect(auth.login).toHaveBeenCalledExactlyOnceWith('test@kangwon.ac.kr', 'Test1234', false, {
      requestIp: httpTrust ? forwardedIp : localIp,
      userAgent: 'context-test',
    });
    expect(resolver.resolveCurrentUserContext).not.toHaveBeenCalled();
  });

  it.each([undefined, 'valid-token', 'invalid-token'])(
    'optional session keeps token %s and missing UA',
    async (token) => {
      const req = request(url).get('/auth/session').set('x-forwarded-for', forwardedIp);
      if (token) req.auth(token, { type: 'bearer' });
      expect((await req).status).toBe(200);
      const context = { requestIp: httpTrust ? forwardedIp : localIp, userAgent: null };
      expect(auth.getSession).toHaveBeenCalledExactlyOnceWith(token ?? null, context);
      if (token)
        expect(resolver.resolveCurrentUserContext).toHaveBeenCalledExactlyOnceWith(token, context);
      else expect(resolver.resolveCurrentUserContext).not.toHaveBeenCalled();
    },
  );

  it('protected guard attaches the same actor and forwards the same metadata as the handler', async () => {
    const response = await request(url)
      .post('/auth/change-password')
      .auth('valid-token', { type: 'bearer' })
      .set('user-agent', 'context-test')
      .set('x-forwarded-for', forwardedIp)
      .send({ currentPassword: 'Test1234', newPassword: 'NewPass1234' });
    expect(response.status).toBe(200);
    const context = { requestIp: httpTrust ? forwardedIp : localIp, userAgent: 'context-test' };
    expect(resolver.resolveCurrentUserContext).toHaveBeenCalledExactlyOnceWith(
      'valid-token',
      context,
    );
    expect(auth.changePassword).toHaveBeenCalledExactlyOnceWith(
      actor,
      'Test1234',
      'NewPass1234',
      context,
    );
    expect(auth.changePassword.mock.calls[0]?.[0]).toBe(actor);
  });

  it('authentication rejection precedes invalid body parsing and service work', async () => {
    const response = await request(url).post('/auth/change-password').send({ invalid: true });
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(auth.changePassword).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'ticket IP preserves forwarded/real header precedence (forwarded=%s)',
    async (withForwarded) => {
      const req = request(url)
        .post('/api/chat/realtime/tickets')
        .auth('valid-token', { type: 'bearer' })
        .set('x-real-ip', realIp);
      if (withForwarded) req.set('x-forwarded-for', `${forwardedIp}, 10.0.0.1`);
      expect((await req).status).toBe(201);
      const ip = withForwarded
        ? chatTrust || httpTrust
          ? forwardedIp
          : localIp
        : chatTrust
          ? realIp
          : localIp;
      expect(consumeTicket).toHaveBeenCalledExactlyOnceWith({
        userId: actor.id,
        ip,
      });
      expect(tickets.issueTicketFromAccessToken).toHaveBeenCalledExactlyOnceWith('valid-token');
    },
  );

  it('ticket limiter retains 429, retry-after, metric and no second ticket side effect', async () => {
    const issue = () =>
      request(url).post('/api/chat/realtime/tickets').auth('valid-token', { type: 'bearer' });
    expect((await issue()).status).toBe(201);
    const response = await issue();
    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBe('60');
    expect(response.body).toMatchObject({
      code: 'CHAT_REALTIME_RATE_LIMITED',
      scope: 'chat:ticket:user',
      retryAfterSeconds: 60,
    });
    expect(metrics.recordRateLimitRejection).toHaveBeenCalledExactlyOnceWith('chat:ticket:user');
    expect(tickets.issueTicketFromAccessToken).toHaveBeenCalledTimes(1);
  });

  it('unauthenticated ticket request never consumes the limiter or issues a ticket', async () => {
    expect((await request(url).post('/api/chat/realtime/tickets')).status).toBe(401);
    expect(consumeTicket).not.toHaveBeenCalled();
    expect(tickets.issueTicketFromAccessToken).not.toHaveBeenCalled();
  });
});
