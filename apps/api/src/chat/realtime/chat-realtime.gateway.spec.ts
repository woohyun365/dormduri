type ModuleRecord = Record<string, unknown>;

type Constructor = new (...args: unknown[]) => Record<string, unknown>;

async function loadRealtimeModule(modulePath: string): Promise<ModuleRecord> {
  return (await import(modulePath)) as ModuleRecord;
}

function expectConstructor(moduleRecord: ModuleRecord, exportName: string): Constructor {
  const exported = moduleRecord[exportName];
  expect(exported).toEqual(expect.any(Function));
  return exported as Constructor;
}

function getMethod<T extends (...args: unknown[]) => unknown>(
  owner: Record<string, unknown>,
  methodName: string,
): T {
  const method = owner[methodName];
  expect(method).toEqual(expect.any(Function));
  return method as T;
}

describe('chat realtime gateway/auth red contract', () => {
  it('expired realtime ticket은 gateway auth에서 거절된다', async () => {
    const ticketModule = await loadRealtimeModule('./chat-realtime-ticket.service.js');
    const TicketService = expectConstructor(ticketModule, 'ChatRealtimeTicketService');
    const ticketService = new TicketService({ secret: 'test-secret', ttlSeconds: 60 });
    const verifyTicket = getMethod<(...args: unknown[]) => Promise<unknown>>(
      ticketService,
      'verifyTicket',
    );

    await expect(
      verifyTicket.call(ticketService, 'expired-ticket', new Date('2026-02-10T03:02:00.000Z')),
    ).rejects.toMatchObject({
      response: { code: 'CHAT_REALTIME_TICKET_INVALID' },
    });
  });

  it('valid ticket 연결은 user room에 join한다', async () => {
    const gatewayModule = await loadRealtimeModule('./chat-realtime.gateway.js');
    const Gateway = expectConstructor(gatewayModule, 'ChatRealtimeGateway');
    const authService = {
      verifyTicket: jest.fn().mockResolvedValue({ userId: 'user-1', sessionId: 'session-1' }),
    };
    const gateway = new Gateway(authService, { canJoinThread: jest.fn() });
    const handleConnection = getMethod<(...args: unknown[]) => Promise<unknown>>(
      gateway,
      'handleConnection',
    );
    const socket = {
      handshake: { auth: { ticket: 'valid-ticket' } },
      join: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      data: {},
    };

    await handleConnection.call(gateway, socket);

    expect(socket.join).toHaveBeenCalledWith('user:user-1');
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('thread room subscribe는 membership policy가 실패하면 거절된다', async () => {
    const gatewayModule = await loadRealtimeModule('./chat-realtime.gateway.js');
    const Gateway = expectConstructor(gatewayModule, 'ChatRealtimeGateway');
    const gateway = new Gateway(
      { verifyTicket: jest.fn() },
      { canJoinThread: jest.fn().mockResolvedValue(false) },
    );
    const handleSubscribeThread = getMethod<(...args: unknown[]) => Promise<unknown>>(
      gateway,
      'handleSubscribeThread',
    );
    const socket = {
      data: { userId: 'user-1' },
      join: jest.fn(),
      emit: jest.fn(),
    };

    await expect(
      handleSubscribeThread.call(gateway, socket, { threadId: 'thread-1' }),
    ).rejects.toMatchObject({
      response: { code: 'CHAT_REALTIME_THREAD_SUBSCRIBE_FORBIDDEN' },
    });
    expect(socket.join).not.toHaveBeenCalled();
  });
});
