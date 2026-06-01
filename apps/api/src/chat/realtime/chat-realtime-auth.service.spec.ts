import { ChatRealtimeAuthService } from './chat-realtime-auth.service.js';

describe('ChatRealtimeAuthService', () => {
  const authUser = {
    id: 'user-1',
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
  };
  const ticketService = {
    consumeTicket: jest.fn(),
  };
  const chatService = {
    getThreadDetail: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('consumeTicket은 ticket service 결과를 그대로 반환한다', async () => {
    ticketService.consumeTicket.mockResolvedValueOnce(authUser);
    const service = new ChatRealtimeAuthService(ticketService as never, chatService as never);

    await expect(service.consumeTicket('ticket-1')).resolves.toBe(authUser);
  });

  it('thread detail을 볼 수 있는 사용자만 subscribe 가능하다', async () => {
    chatService.getThreadDetail.mockResolvedValueOnce({ thread: { id: 'thread-1' } });
    const service = new ChatRealtimeAuthService(ticketService as never, chatService as never);

    await expect(service.canSubscribeThread(authUser, 'thread-1')).resolves.toBe(true);
    expect(chatService.getThreadDetail).toHaveBeenCalledWith(authUser, 'thread-1');
  });

  it('thread detail 권한이 없으면 subscribe를 거절한다', async () => {
    chatService.getThreadDetail.mockRejectedValueOnce(new Error('not found'));
    const service = new ChatRealtimeAuthService(ticketService as never, chatService as never);

    await expect(service.canSubscribeThread(authUser, 'thread-1')).resolves.toBe(false);
  });
});
