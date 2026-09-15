import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAT_REALTIME_ERROR_EVENT_NAME } from './chat-realtime.constants.js';
import { ChatRealtimeGateway } from './chat-realtime.gateway.js';
import { ChatRealtimeMetricsService } from './chat-realtime.metrics.js';

type TestSocket = {
  id: string;
  conn: { remoteAddress: string };
  handshake: {
    address: string;
    auth: { ticket?: string };
    headers: Record<string, string>;
    query: Record<string, string>;
  };
  data: {
    authUser?: {
      id: string;
      gender: 'M';
      campus: 'CHUNCHEON';
    };
    registeredRealtimeUserId?: string;
  };
  join: (room: string) => Promise<void>;
  leave: (room: string) => Promise<void>;
  emit: (event: string, payload: unknown) => void;
  disconnect: (close: boolean) => void;
};

function createSocket(ticket: string | null = 'ticket-1'): TestSocket {
  const join = vi.fn((_room: string) => Promise.resolve());
  const leave = vi.fn((_room: string) => Promise.resolve());
  const emit = vi.fn((_event: string, _payload: unknown) => undefined);
  const disconnect = vi.fn((_close: boolean) => undefined);

  return {
    id: 'socket-1',
    conn: { remoteAddress: '10.0.0.2' },
    handshake: {
      address: '203.0.113.10',
      auth: ticket ? { ticket } : {},
      headers: { 'x-forwarded-for': '203.0.113.10' },
      query: {},
    },
    data: {},
    join,
    leave,
    emit,
    disconnect,
  } satisfies TestSocket;
}

function createQueryTicketSocket(ticket: string): TestSocket {
  return {
    ...createSocket(null),
    handshake: {
      address: '203.0.113.10',
      auth: {},
      headers: { 'x-forwarded-for': '203.0.113.10' },
      query: { ticket },
    },
  };
}

describe('ChatRealtimeGateway', () => {
  const authUser = {
    id: 'user-1',
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
  };
  const authService = {
    consumeTicket: vi.fn(),
    canSubscribeThread: vi.fn(),
  };
  const publisher = {
    bindServer: vi.fn(),
  };
  const rateLimiter = {
    resolveRequestIp: vi.fn(),
    consumeGatewayConnectIp: vi.fn(),
    consumeGatewayConnectUser: vi.fn(),
    tryRegisterUserSocket: vi.fn(),
    unregisterUserSocket: vi.fn(),
    consumeThreadSubscription: vi.fn(),
  };
  let metrics: ChatRealtimeMetricsService;
  let gateway: ChatRealtimeGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimiter.consumeGatewayConnectIp.mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
      scope: 'chat:ws:connect:ip',
    });
    rateLimiter.consumeGatewayConnectUser.mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
      scope: 'chat:ws:connect:user',
    });
    rateLimiter.tryRegisterUserSocket.mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
      scope: 'chat:ws:connect:concurrent-user',
    });
    rateLimiter.consumeThreadSubscription.mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
      scope: 'chat:ws:subscribe:socket',
    });
    rateLimiter.resolveRequestIp.mockReturnValue('203.0.113.10');
    metrics = new ChatRealtimeMetricsService();
    gateway = new ChatRealtimeGateway(
      authService as never,
      publisher as never,
      metrics,
      rateLimiter as never,
    );
  });

  it('afterInit은 publisher에 Socket.IO server를 bind한다', () => {
    const server = { to: vi.fn() };

    gateway.afterInit(server as never);

    expect(publisher.bindServer).toHaveBeenCalledWith(server);
  });

  it('valid ticket connection은 user room에 join하고 metrics를 증가시킨다', async () => {
    authService.consumeTicket.mockResolvedValueOnce(authUser);
    const socket = createSocket('ticket-1');

    await gateway.handleConnection(socket as never);

    expect(rateLimiter.resolveRequestIp).toHaveBeenCalledWith({
      headers: socket.handshake.headers,
      peerAddress: socket.conn.remoteAddress,
    });
    expect(rateLimiter.consumeGatewayConnectIp).toHaveBeenCalledWith({ ip: '203.0.113.10' });
    expect(authService.consumeTicket).toHaveBeenCalledWith('ticket-1');
    expect(rateLimiter.consumeGatewayConnectUser).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(rateLimiter.tryRegisterUserSocket).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(socket.data.authUser).toBe(authUser);
    expect(socket.data.registeredRealtimeUserId).toBe('user-1');
    expect(socket.join).toHaveBeenCalledWith('user:user-1');
    expect(metrics.snapshot().connectedSockets).toBe(1);

    gateway.handleDisconnect(socket as never);
    expect(rateLimiter.unregisterUserSocket).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(metrics.snapshot().connectedSockets).toBe(0);
  });

  it('gateway connection은 HTTP global throttler에 의존하지 않고 자체 IP limiter를 ticket consume 전에 호출한다', async () => {
    rateLimiter.consumeGatewayConnectIp.mockReturnValueOnce({
      allowed: false,
      retryAfterSeconds: 12,
      scope: 'chat:ws:connect:ip',
    });
    const socket = createSocket('ticket-1');

    await gateway.handleConnection(socket as never);

    expect(authService.consumeTicket).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(CHAT_REALTIME_ERROR_EVENT_NAME, {
      code: 'CHAT_REALTIME_RATE_LIMITED',
      retryAfterSeconds: 12,
    });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.join).not.toHaveBeenCalled();
    expect(metrics.snapshot().rateLimitRejections).toMatchObject({
      'chat:ws:connect:ip': 1,
    });
  });

  it('ticket consume 후 user limiter 초과 시 user room에 join하지 않는다', async () => {
    authService.consumeTicket.mockResolvedValueOnce(authUser);
    rateLimiter.consumeGatewayConnectUser.mockReturnValueOnce({
      allowed: false,
      retryAfterSeconds: 8,
      scope: 'chat:ws:connect:user',
    });
    const socket = createSocket('ticket-1');

    await gateway.handleConnection(socket as never);

    expect(rateLimiter.consumeGatewayConnectUser).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(rateLimiter.tryRegisterUserSocket).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(CHAT_REALTIME_ERROR_EVENT_NAME, {
      code: 'CHAT_REALTIME_RATE_LIMITED',
      retryAfterSeconds: 8,
    });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('invalid/expired ticket connection은 error를 emit하고 disconnect한다', async () => {
    authService.consumeTicket.mockResolvedValueOnce(null);
    const socket = createSocket('expired-ticket');

    await gateway.handleConnection(socket as never);

    expect(socket.emit).toHaveBeenCalledWith(CHAT_REALTIME_ERROR_EVENT_NAME, {
      code: 'CHAT_REALTIME_UNAUTHENTICATED',
    });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.join).not.toHaveBeenCalled();
    expect(metrics.snapshot().authFailures).toMatchObject({
      ticket_invalid: 1,
    });
  });

  it('URL query ticket은 access log 노출 위험 때문에 connection 인증에 사용하지 않는다', async () => {
    const socket = createQueryTicketSocket('query-ticket');

    await gateway.handleConnection(socket as never);

    expect(authService.consumeTicket).toHaveBeenCalledWith(null);
    expect(socket.emit).toHaveBeenCalledWith(CHAT_REALTIME_ERROR_EVENT_NAME, {
      code: 'CHAT_REALTIME_UNAUTHENTICATED',
    });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('authorized thread subscribe는 thread room에 join한다', async () => {
    authService.canSubscribeThread.mockResolvedValueOnce(true);
    const socket = createSocket();
    socket.data.authUser = authUser;

    await expect(
      gateway.subscribeThread(socket as never, { threadId: ' thread-1 ' }),
    ).resolves.toEqual({
      ok: true,
      threadId: 'thread-1',
    });

    expect(rateLimiter.consumeThreadSubscription).toHaveBeenCalledWith({ socketId: 'socket-1' });
    expect(authService.canSubscribeThread).toHaveBeenCalledWith(authUser, 'thread-1');
    expect(socket.join).toHaveBeenCalledWith('thread:thread-1');
  });

  it('authenticated thread unsubscribe는 thread room에서 leave한다', async () => {
    const socket = createSocket();
    socket.data.authUser = authUser;

    await expect(
      gateway.unsubscribeThread(socket as never, { threadId: ' thread-1 ' }),
    ).resolves.toEqual({
      ok: true,
      threadId: 'thread-1',
    });

    expect(rateLimiter.consumeThreadSubscription).toHaveBeenCalledWith({ socketId: 'socket-1' });
    expect(socket.leave).toHaveBeenCalledWith('thread:thread-1');
  });

  it('unauthorized thread subscribe는 join하지 않고 거절한다', async () => {
    authService.canSubscribeThread.mockResolvedValueOnce(false);
    const socket = createSocket();
    socket.data.authUser = authUser;

    await expect(
      gateway.subscribeThread(socket as never, { threadId: 'thread-2' }),
    ).resolves.toEqual({
      ok: false,
      reason: 'UNAUTHORIZED_THREAD',
    });

    expect(rateLimiter.consumeThreadSubscription).toHaveBeenCalledWith({
      socketId: 'socket-1',
      failed: true,
    });
    expect(socket.join).not.toHaveBeenCalled();
    expect(metrics.snapshot().subscribeRejections).toMatchObject({
      UNAUTHORIZED_THREAD: 1,
    });
  });

  it('invalid thread subscribe는 payload 없이 거절 metric만 남기고 join하지 않는다', async () => {
    const socket = createSocket();
    socket.data.authUser = authUser;

    await expect(gateway.subscribeThread(socket as never, {})).resolves.toEqual({
      ok: false,
      reason: 'INVALID_REQUEST',
    });

    expect(rateLimiter.consumeThreadSubscription).toHaveBeenCalledWith({
      socketId: 'socket-1',
      failed: true,
    });
    expect(authService.canSubscribeThread).not.toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
    expect(metrics.snapshot().subscribeRejections).toMatchObject({
      INVALID_REQUEST: 1,
    });
  });

  it('thread subscribe churn limiter 초과 시 membership check 없이 disconnect한다', async () => {
    rateLimiter.consumeThreadSubscription.mockReturnValueOnce({
      allowed: false,
      retryAfterSeconds: 5,
      scope: 'chat:ws:subscribe:failure',
    });
    const socket = createSocket();
    socket.data.authUser = authUser;

    await expect(gateway.subscribeThread(socket as never, {})).resolves.toEqual({
      ok: false,
      reason: 'RATE_LIMITED',
    });

    expect(authService.canSubscribeThread).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(CHAT_REALTIME_ERROR_EVENT_NAME, {
      code: 'CHAT_REALTIME_RATE_LIMITED',
      retryAfterSeconds: 5,
    });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(metrics.snapshot().rateLimitRejections).toMatchObject({
      'chat:ws:subscribe:failure': 1,
    });
  });
});
