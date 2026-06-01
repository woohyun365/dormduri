import { CHAT_REALTIME_ERROR_EVENT_NAME } from './chat-realtime.constants.js';
import { ChatRealtimeGateway } from './chat-realtime.gateway.js';
import { ChatRealtimeMetricsService } from './chat-realtime.metrics.js';

type TestSocket = {
  handshake: {
    auth: { ticket?: string };
    query: Record<string, string>;
  };
  data: {
    authUser?: {
      id: string;
      gender: 'M';
      campus: 'CHUNCHEON';
    };
  };
  join: (room: string) => Promise<void>;
  leave: (room: string) => Promise<void>;
  emit: (event: string, payload: unknown) => void;
  disconnect: (close: boolean) => void;
};

function createSocket(ticket: string | null = 'ticket-1'): TestSocket {
  const join = jest.fn((_room: string) => Promise.resolve());
  const leave = jest.fn((_room: string) => Promise.resolve());
  const emit = jest.fn((_event: string, _payload: unknown) => undefined);
  const disconnect = jest.fn((_close: boolean) => undefined);

  return {
    handshake: {
      auth: ticket ? { ticket } : {},
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
      auth: {},
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
    consumeTicket: jest.fn(),
    canSubscribeThread: jest.fn(),
  };
  const publisher = {
    bindServer: jest.fn(),
  };
  let metrics: ChatRealtimeMetricsService;
  let gateway: ChatRealtimeGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    metrics = new ChatRealtimeMetricsService();
    gateway = new ChatRealtimeGateway(authService as never, publisher as never, metrics);
  });

  it('afterInit은 publisher에 Socket.IO server를 bind한다', () => {
    const server = { to: jest.fn() };

    gateway.afterInit(server as never);

    expect(publisher.bindServer).toHaveBeenCalledWith(server);
  });

  it('valid ticket connection은 user room에 join하고 metrics를 증가시킨다', async () => {
    authService.consumeTicket.mockResolvedValueOnce(authUser);
    const socket = createSocket('ticket-1');

    await gateway.handleConnection(socket as never);

    expect(authService.consumeTicket).toHaveBeenCalledWith('ticket-1');
    expect(socket.data.authUser).toBe(authUser);
    expect(socket.join).toHaveBeenCalledWith('user:user-1');
    expect(metrics.snapshot().connectedSockets).toBe(1);

    gateway.handleDisconnect();
    expect(metrics.snapshot().connectedSockets).toBe(0);
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

    expect(socket.join).not.toHaveBeenCalled();
  });
});
