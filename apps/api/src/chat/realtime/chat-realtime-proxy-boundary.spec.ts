import { afterEach, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { request as httpRequest } from 'node:http';
import { randomBytes } from 'node:crypto';
import { EventEmitter, once } from 'node:events';
import type { Socket } from 'node:net';
import request from 'supertest';
import { ChatController } from '../chat.controller.js';
import { ChatService } from '../application/chat.service.js';
import { ChatThreadContextResolver } from '../context/chat-thread-context.resolver.js';
import { AuthenticatedUserGuard } from '../../auth/access/authenticated-user.guard.js';
import { AuthActorContextResolver } from '../../auth/application/auth-actor-context.resolver.js';
import { ApiExceptionFilter } from '../../platform/http/api-exception.filter.js';
import chatRealtimeConfig from './chat-realtime.config.js';
import { ChatRealtimeIoAdapter } from './chat-realtime-io.adapter.js';
import { ChatRealtimeGateway } from './chat-realtime.gateway.js';
import { ChatRealtimeAuthService } from './chat-realtime-auth.service.js';
import { ChatRealtimePublisher } from './chat-realtime-publisher.js';
import { ChatRealtimeRateLimiterService } from './chat-realtime-rate-limiter.service.js';
import { ChatRealtimeMetricsService } from './chat-realtime.metrics.js';
import { ChatRealtimeTicketService } from './chat-realtime-ticket.service.js';
import { createHttpAdapter } from '../../platform/http/http-adapter.js';

const origin = 'https://api.example';
const actor = (token = 'synthetic') => ({
  id: token,
  actorId: token,
  actorType: 'USER',
  sessionId: token,
  campus: 'CHUNCHEON',
  gender: 'M',
  capabilities: [],
});
let app: INestApplication | undefined;
const sockets: Socket[] = [];
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.destroy();
  await app?.close();
  app = undefined;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function initialize(overrides: Record<string, string | undefined> = {}) {
  for (const [key, value] of Object.entries({
    NODE_ENV: 'test',
    CHAT_REALTIME_TRUST_PROXY: 'true',
    HTTP_TRUST_PROXY_HOPS: '0',
    HTTP_TRUST_PROXY_CIDRS: '127.0.0.1',
    CHAT_REALTIME_ALLOWED_ORIGINS: origin,
    CHAT_REALTIME_TICKET_IP_LIMIT: '1',
    CHAT_REALTIME_TICKET_USER_LIMIT: '100',
    CHAT_REALTIME_WS_CONNECT_IP_LIMIT: '1',
    ...overrides,
  }))
    vi.stubEnv(key, value);
  // Gateway was imported before these values. Only the DI-time snapshot may activate hooks.
  const module = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ ignoreEnvFile: true, load: [chatRealtimeConfig] })],
    controllers: [ChatController],
    providers: [
      ChatRealtimeGateway,
      ChatRealtimeRateLimiterService,
      ChatRealtimeMetricsService,
      { provide: ChatService, useValue: {} },
      { provide: ChatThreadContextResolver, useValue: {} },
      {
        provide: ChatRealtimeTicketService,
        useValue: {
          issueTicketFromAccessToken: (token: string) => Promise.resolve({ ticket: token }),
        },
      },
      {
        provide: ChatRealtimeAuthService,
        useValue: {
          consumeTicket: (token: string) => Promise.resolve(token ? actor(token) : null),
        },
      },
      { provide: ChatRealtimePublisher, useValue: { bindServer: vi.fn() } },
      {
        provide: AuthActorContextResolver,
        useValue: { resolveCurrentUserContext: (token: string) => Promise.resolve(actor(token)) },
      },
      AuthenticatedUserGuard,
      Reflector,
    ],
  }).compile();
  app = module.createNestApplication(createHttpAdapter(false), { logger: false });
  const settings = module.get<ConfigType<typeof chatRealtimeConfig>>(chatRealtimeConfig.KEY);
  app.useWebSocketAdapter(new ChatRealtimeIoAdapter(app, settings));
  app.useGlobalGuards(module.get(AuthenticatedUserGuard));
  app.useGlobalFilters(
    new ApiExceptionFilter(
      { write: vi.fn() } as never,
      { recordException: vi.fn() } as never,
      module.get(HttpAdapterHost),
    ),
  );
  await app.listen(0, '127.0.0.1');
  return {
    app,
    url: await app.getUrl(),
    limiter: module.get(ChatRealtimeRateLimiterService),
    metrics: module.get(ChatRealtimeMetricsService),
    settings,
  };
}

async function polling(base: string, forwarded: string | string[]) {
  const path = '/socket.io/?EIO=4&transport=polling';
  const response = await request(base)
    .get(path)
    .set('Origin', origin)
    .set({ 'x-forwarded-for': forwarded });
  if (response.status !== 200) return { status: response.status, packet: response.text };
  const sid = (JSON.parse(response.text.slice(1)) as { sid: string }).sid;
  const session = `${path}&sid=${sid}`;
  await request(base)
    .post(session)
    .set('Origin', origin)
    .set('Content-Type', 'text/plain')
    .send(`40/chat,${JSON.stringify({ ticket: randomBytes(8).toString('hex') })}`)
    .expect(200);
  const connected = await request(base).get(session).set('Origin', origin);
  return { status: response.status, packet: connected.text };
}

// Small bounded wire client: proves actual Engine.IO + namespace connection without a new dependency.
async function websocket(
  base: string,
  forwarded: string,
  options: { sid?: string; expectedPacket?: string; ticket?: string } = {},
) {
  const target = new URL('/socket.io/?EIO=4&transport=websocket', base);
  if (options.sid) target.searchParams.set('sid', options.sid);
  const ticket = options.ticket ?? randomBytes(8).toString('hex');
  return new Promise<{ status: number; packet: string }>((resolve, reject) => {
    const req = httpRequest(target, {
      headers: {
        Origin: origin,
        'x-forwarded-for': forwarded,
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
      },
    });
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error('WebSocket namespace timeout'));
    }, 3000);
    req.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    req.once('response', (response) => {
      response.resume();
      clearTimeout(timeout);
      resolve({ status: response.statusCode ?? 0, packet: '' });
    });
    req.once('upgrade', (_response, socket, head) => {
      sockets.push(socket);
      let buffered = Buffer.alloc(0);
      const send = (text: string) => {
        const payload = Buffer.from(text);
        const mask = randomBytes(4);
        if (payload.length >= 126) throw new Error('Fixture packet too long');
        socket.write(
          Buffer.concat([
            Buffer.from([0x81, 0x80 | payload.length]),
            mask,
            Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]!)),
          ]),
        );
      };
      const receive = (chunk: Buffer) => {
        buffered = Buffer.concat([buffered, chunk]);
        while (buffered.length >= 2) {
          const kind = buffered[0]! & 15;
          let length = buffered[1]! & 127;
          let offset = 2;
          if (length === 126) {
            if (buffered.length < 4) return;
            length = buffered.readUInt16BE(2);
            offset = 4;
          }
          if (length === 127) {
            clearTimeout(timeout);
            reject(new Error('Unbounded fixture frame'));
            socket.destroy();
            return;
          }
          if (buffered.length < offset + length) return;
          const packet = buffered.subarray(offset, offset + length).toString();
          buffered = buffered.subarray(offset + length);
          if (kind !== 1) continue;
          if (packet.startsWith('0')) send(`40/chat,${JSON.stringify({ ticket })}`);
          if (packet === '3probe') {
            send('5');
            send(`40/chat,${JSON.stringify({ ticket })}`);
          }
          if (packet.startsWith(options.expectedPacket ?? '40/chat,')) {
            clearTimeout(timeout);
            resolve({ status: 101, packet });
            return;
          }
        }
      };
      if (options.sid) send('2probe');
      socket.on('data', receive);
      if (head.length) receive(head);
      socket.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    req.end();
  });
}

describe('actual Nest chat proxy initialization and transport boundaries', () => {
  it('실제 auth 거절 disconnect hook은 다른 counted connection의 gauge/admission을 보존한다', async () => {
    const events = new EventEmitter();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Rebound to each real gateway with .call below.
    const originalDisconnect = ChatRealtimeGateway.prototype.handleDisconnect;
    const disconnect = vi
      .spyOn(ChatRealtimeGateway.prototype, 'handleDisconnect')
      .mockImplementation(function (this: ChatRealtimeGateway, client) {
        originalDisconnect.call(this, client);
        events.emit('disconnected');
      });
    const running = await initialize();
    const originalConnected = running.metrics.recordSocketConnected.bind(running.metrics);
    vi.spyOn(running.metrics, 'recordSocketConnected').mockImplementation(() => {
      originalConnected();
      events.emit('counted');
    });
    // A namespace ACK precedes async auth/join; wait for actual accounting instead.
    await Promise.all([
      once(events, 'counted', { signal: AbortSignal.timeout(3000) }),
      websocket(running.url, '203.0.113.1', { ticket: 'live-b' }),
    ]);
    expect(running.metrics.snapshot()).toMatchObject({ connectedSockets: 1, totalConnections: 1 });
    expect(running.limiter.getUserSocketCountForTest('live-b')).toBe(1);
    const [, rejected] = await Promise.all([
      once(events, 'disconnected', { signal: AbortSignal.timeout(3000) }),
      websocket(running.url, '203.0.113.2', { ticket: '', expectedPacket: '42/chat,' }),
    ]);
    expect(rejected.packet).toContain('CHAT_REALTIME_UNAUTHENTICATED');
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(running.metrics.snapshot()).toMatchObject({ connectedSockets: 1, totalConnections: 1 });
    expect(running.limiter.getUserSocketCountForTest('live-b')).toBe(1);
    const closed = once(events, 'disconnected', { signal: AbortSignal.timeout(3000) });
    sockets[0]!.destroy();
    await closed;
    expect(disconnect).toHaveBeenCalledTimes(2);
    expect(running.metrics.snapshot()).toMatchObject({ connectedSockets: 0, totalConnections: 1 });
    expect(running.limiter.getUserSocketCountForTest('live-b')).toBe(0);
  });

  it.each(['polling', 'websocket'] as const)(
    '%s preserves distinct client buckets at root and gateway using the same DI snapshot',
    async (transport) => {
      const running = await initialize();
      const connect = transport === 'polling' ? polling : websocket;
      const gatewayLimit = vi.spyOn(running.limiter, 'consumeGatewayConnectIp');
      // Changing env after assembly must not alter only one transport or the HTTP ticket path.
      vi.stubEnv('CHAT_REALTIME_TRUST_PROXY', 'false');
      vi.stubEnv('CHAT_REALTIME_ALLOWED_ORIGINS', 'https://evil.example');
      const first = await connect(running.url, '203.0.113.1');
      expect(first.packet).toContain('40/chat,');
      expect(gatewayLimit).toHaveBeenCalledWith({ ip: '203.0.113.1' });
      expect((await connect(running.url, '203.0.113.1')).status).toBe(
        transport === 'websocket' ? 400 : 403,
      );
      expect((await connect(running.url, '203.0.113.2')).packet).toContain('40/chat,');
      const ticket = (ip: string, user: string) =>
        request(running.url)
          .post('/api/chat/realtime/tickets')
          .auth(user, { type: 'bearer' })
          .set('x-forwarded-for', ip);
      expect((await ticket('203.0.113.1', 'u1')).status).toBe(201);
      expect((await ticket('203.0.113.1', 'u2')).status).toBe(429);
      expect((await ticket('203.0.113.2', 'u3')).status).toBe(201);
    },
  );
  it.each(['polling', 'websocket'] as const)(
    '%s untrusted peer prefix rotation shares the raw-peer budget',
    async (transport) => {
      const running = await initialize({ HTTP_TRUST_PROXY_CIDRS: '192.0.2.2' });
      const connect = transport === 'polling' ? polling : websocket;
      const gatewayLimit = vi.spyOn(running.limiter, 'consumeGatewayConnectIp');
      expect((await connect(running.url, '203.0.113.1')).packet).toContain('40/chat,');
      expect(gatewayLimit).toHaveBeenCalledWith({ ip: '127.0.0.1' });
      expect((await connect(running.url, '203.0.113.2')).status).toBe(
        transport === 'websocket' ? 400 : 403,
      );
    },
  );
  it('wire duplicate XFF is not an identity and origin rejection spends no budget', async () => {
    const running = await initialize();
    await request(running.url)
      .get('/socket.io/?EIO=4&transport=polling')
      .set('Origin', 'https://evil.example')
      .expect(403);
    expect((await polling(running.url, ['203.0.113.1', '203.0.113.2'])).packet).toContain(
      '40/chat,',
    );
    expect((await polling(running.url, ['203.0.113.3', '203.0.113.4'])).status).toBe(403);
  });
  it('DI origin mutation cannot change admission independently of CORS', async () => {
    const running = await initialize();
    if (running.settings.allowedOrigins === false) throw new Error('Missing fixture origins');
    expect(Reflect.set(running.settings.allowedOrigins, '0', 'https://evil.example')).toBe(false);
    const path = '/socket.io/?EIO=4&transport=polling';
    await request(running.url).get(path).set('Origin', 'https://evil.example').expect(403);
    const allowed = await request(running.url).get(path).set('Origin', origin).expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(origin);
  });

  it.each(['polling', 'websocket'] as const)(
    '%s proves the independent gateway budget denies after root admission',
    async (transport) => {
      const running = await initialize();
      running.limiter.consumeGatewayConnectIp({ ip: '203.0.113.1' });
      const result =
        transport === 'polling'
          ? await polling(running.url, '203.0.113.1')
          : await websocket(running.url, '203.0.113.1', { expectedPacket: '42/chat,' });
      expect(result.status).toBe(transport === 'polling' ? 200 : 101);
      expect(result.packet).toContain('CHAT_REALTIME_RATE_LIMITED');
    },
  );

  it('polling→WebSocket upgrade keeps the original cached peer and identity', async () => {
    const running = await initialize();
    const gatewayLimit = vi.spyOn(running.limiter, 'consumeGatewayConnectIp');
    const opened = await request(running.url)
      .get('/socket.io/?EIO=4&transport=polling')
      .set('Origin', origin)
      .set('x-forwarded-for', '203.0.113.1')
      .set('Connection', 'close')
      .expect(200);
    const sid = (JSON.parse(opened.text.slice(1)) as { sid: string }).sid;
    expect((await websocket(running.url, '203.0.113.2', { sid })).packet).toContain('40/chat,');
    expect(gatewayLimit).toHaveBeenCalledExactlyOnceWith({ ip: '203.0.113.1' });
  });

  it.each([
    { HTTP_TRUST_PROXY_CIDRS: '' },
    { HTTP_TRUST_PROXY_HOPS: '1', HTTP_TRUST_PROXY_CIDRS: '' },
    { HTTP_TRUST_PROXY_HOPS: '1' },
    { HTTP_TRUST_PROXY_CIDRS: 'loopback' },
  ])(
    'invalid DI configuration never creates a Socket.IO root or listener: %j',
    async (overrides) => {
      const createRoot = vi.spyOn(ChatRealtimeIoAdapter.prototype, 'createIOServer');
      await expect(initialize(overrides)).rejects.toThrow();
      expect(createRoot).not.toHaveBeenCalled();
      expect(app).toBeUndefined();
    },
  );
});
