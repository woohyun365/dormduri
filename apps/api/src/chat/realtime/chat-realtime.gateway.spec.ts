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

  it('직접 주입한 duplicate disconnect는 다른 counted socket의 gauge를 감소시키지 않는다', async () => {
    const a = { ...createSocket('ticket-a'), id: 'socket-a' };
    const b = { ...createSocket('ticket-b'), id: 'socket-b' };
    authService.consumeTicket.mockResolvedValueOnce(authUser).mockResolvedValueOnce(authUser);
    await gateway.handleConnection(a as never);
    await gateway.handleConnection(b as never);
    expect(metrics.snapshot()).toMatchObject({ connectedSockets: 2, totalConnections: 2 });
    gateway.handleDisconnect(a as never);
    expect(metrics.snapshot().connectedSockets).toBe(1);
    gateway.handleDisconnect(a as never);
    expect(metrics.snapshot()).toMatchObject({ connectedSockets: 1, totalConnections: 2 });
    expect(rateLimiter.unregisterUserSocket).toHaveBeenCalledTimes(1);
    gateway.handleDisconnect(b as never);
    gateway.handleDisconnect(b as never);
    expect(metrics.snapshot()).toMatchObject({ connectedSockets: 0, totalConnections: 2 });
    expect(rateLimiter.unregisterUserSocket).toHaveBeenCalledTimes(2);
  });

  it.each(['auth', 'ip', 'user', 'concurrent'] as const)(
    '%s rejected socket의 직접 주입 disconnect는 counted B를 감소시키지 않는다',
    async (rejectedAt) => {
      const b = { ...createSocket('ticket-b'), id: 'socket-b' };
      const a = { ...createSocket('ticket-a'), id: 'socket-a' };
      authService.consumeTicket.mockResolvedValueOnce(authUser);
      await gateway.handleConnection(b as never);
      if (rejectedAt === 'auth') authService.consumeTicket.mockResolvedValueOnce(null);
      else if (rejectedAt !== 'ip') authService.consumeTicket.mockResolvedValueOnce(authUser);
      const rejected = { allowed: false, retryAfterSeconds: 1 };
      if (rejectedAt === 'ip')
        rateLimiter.consumeGatewayConnectIp.mockReturnValueOnce({
          ...rejected,
          scope: 'chat:ws:connect:ip',
        });
      if (rejectedAt === 'user')
        rateLimiter.consumeGatewayConnectUser.mockReturnValueOnce({
          ...rejected,
          scope: 'chat:ws:connect:user',
        });
      if (rejectedAt === 'concurrent')
        rateLimiter.tryRegisterUserSocket.mockReturnValueOnce({
          ...rejected,
          scope: 'chat:ws:connect:concurrent-user',
        });
      await gateway.handleConnection(a as never);
      expect(a.disconnect).toHaveBeenCalledWith(true);
      expect(a.join).not.toHaveBeenCalled();
      expect(a.data.registeredRealtimeUserId).toBeUndefined();
      // This direct call is defensive ordering evidence, not framework reachability evidence.
      gateway.handleDisconnect(a as never);
      gateway.handleDisconnect(a as never);
      expect(metrics.snapshot()).toMatchObject({ connectedSockets: 1, totalConnections: 1 });
      expect(rateLimiter.unregisterUserSocket).not.toHaveBeenCalled();
      gateway.handleDisconnect(b as never);
      expect(metrics.snapshot().connectedSockets).toBe(0);
    },
  );

  it.each(['undefined', 'unregistered'] as const)(
    '%s callback은 살아 있는 counted socket에 영향을 주지 않는다',
    async (kind) => {
      authService.consumeTicket.mockResolvedValueOnce(authUser);
      const b = createSocket('ticket-b');
      await gateway.handleConnection(b as never);
      const client = kind === 'undefined' ? undefined : createSocket(null);
      gateway.handleDisconnect(client as never);
      gateway.handleDisconnect(client as never);
      expect(metrics.snapshot()).toMatchObject({ connectedSockets: 1, totalConnections: 1 });
      expect(rateLimiter.unregisterUserSocket).not.toHaveBeenCalled();
      gateway.handleDisconnect(b as never);
      expect(metrics.snapshot().connectedSockets).toBe(0);
    },
  );

  it.each([
    ...(['auth', 'join'] as const).flatMap((point) =>
      (['resolve', 'reject'] as const).map((outcome) => ({ point, outcome })),
    ),
    { point: 'auth', outcome: 'invalid' } as const,
  ])(
    'pending $point / $outcome: disconnect 이후 gauge가 부활하지 않는다',
    async ({ point, outcome }) => {
      authService.consumeTicket.mockResolvedValueOnce(authUser);
      const b = { ...createSocket('ticket-b'), id: 'socket-b' };
      const a = { ...createSocket('ticket-a'), id: 'socket-a' };
      await gateway.handleConnection(b as never);
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const error = new Error('pending connection failed');
      const wait = async () => {
        entered();
        await pending;
        if (outcome === 'reject') throw error;
      };
      if (point === 'auth') {
        authService.consumeTicket.mockImplementationOnce(async () => {
          await wait();
          return outcome === 'invalid' ? null : authUser;
        });
      } else {
        authService.consumeTicket.mockResolvedValueOnce(authUser);
        vi.mocked(a.join).mockImplementationOnce(wait);
      }
      const settled = gateway.handleConnection(a as never).then(
        () => null,
        (reason: unknown) => reason,
      );
      try {
        await started;
        expect(a.data.registeredRealtimeUserId).toBe(point === 'join' ? authUser.id : undefined);
        gateway.handleDisconnect(a as never);
        const duringDisconnect = metrics.snapshot();
        release();
        expect(await settled).toBe(outcome === 'reject' ? error : null);
        if (outcome === 'invalid') {
          expect(metrics.snapshot().authFailures).toEqual({ ticket_invalid: 1 });
          expect(a.emit).toHaveBeenCalledWith(CHAT_REALTIME_ERROR_EVENT_NAME, {
            code: 'CHAT_REALTIME_UNAUTHENTICATED',
          });
          expect(a.disconnect).toHaveBeenCalledWith(true);
        }
        // A recorded disconnect is terminal: successful late auth must not admit a dead socket.
        expect.soft(a.data.registeredRealtimeUserId).toBeUndefined();
        expect
          .soft(rateLimiter.consumeGatewayConnectUser)
          .toHaveBeenCalledTimes(point === 'join' ? 2 : 1);
        expect
          .soft(rateLimiter.tryRegisterUserSocket)
          .toHaveBeenCalledTimes(point === 'join' ? 2 : 1);
        expect
          .soft(rateLimiter.unregisterUserSocket)
          .toHaveBeenCalledTimes(point === 'join' ? 1 : 0);
        if (point === 'auth') expect.soft(a.join).not.toHaveBeenCalled();
        expect.soft(duringDisconnect).toMatchObject({ connectedSockets: 1, totalConnections: 1 });
        expect(metrics.snapshot()).toMatchObject({ connectedSockets: 1, totalConnections: 1 });
        gateway.handleDisconnect(a as never);
        expect(metrics.snapshot().connectedSockets).toBe(1);
        gateway.handleDisconnect(b as never);
        expect(metrics.snapshot()).toMatchObject({ connectedSockets: 0, totalConnections: 1 });
      } finally {
        release();
        await settled;
      }
    },
  );

  it('일반 두 connect/disconnect의 gauge와 누적 counter는 균형을 유지한다', async () => {
    authService.consumeTicket.mockResolvedValueOnce(authUser).mockResolvedValueOnce(authUser);
    const a = { ...createSocket('ticket-a'), id: 'socket-a' };
    const b = { ...createSocket('ticket-b'), id: 'socket-b' };
    await gateway.handleConnection(a as never);
    await gateway.handleConnection(b as never);
    gateway.handleDisconnect(a as never);
    expect(metrics.snapshot()).toMatchObject({ connectedSockets: 1, totalConnections: 2 });
    gateway.handleDisconnect(b as never);
    expect(metrics.snapshot()).toMatchObject({ connectedSockets: 0, totalConnections: 2 });
  });

  it.each(['setGauge', 'incrementCounter'] as const)(
    '%s bridge 실패에도 gateway connection bookkeeping은 유지된다',
    async (method) => {
      const bridge = { setGauge: vi.fn(), incrementCounter: vi.fn(), observeHistogram: vi.fn() };
      bridge[method].mockImplementation(() => {
        throw new Error('metric rejected');
      });
      metrics = new ChatRealtimeMetricsService(bridge);
      gateway = new ChatRealtimeGateway(
        authService as never,
        publisher as never,
        metrics,
        rateLimiter as never,
      );
      authService.consumeTicket.mockResolvedValueOnce(authUser).mockResolvedValueOnce(authUser);
      const a = { ...createSocket('ticket-a'), id: 'socket-a' };
      const b = { ...createSocket('ticket-b'), id: 'socket-b' };
      await gateway.handleConnection(a as never);
      await gateway.handleConnection(b as never);
      expect(metrics.snapshot()).toMatchObject({ connectedSockets: 2, totalConnections: 2 });
      gateway.handleDisconnect(a as never);
      expect(metrics.snapshot()).toMatchObject({ connectedSockets: 1, totalConnections: 2 });
      gateway.handleDisconnect(a as never);
      expect(metrics.snapshot()).toMatchObject({ connectedSockets: 1, totalConnections: 2 });
      gateway.handleDisconnect(b as never);
      expect(metrics.snapshot()).toMatchObject({ connectedSockets: 0, totalConnections: 2 });
      expect(rateLimiter.unregisterUserSocket).toHaveBeenCalledTimes(2);
    },
  );

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
