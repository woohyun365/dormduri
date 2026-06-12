import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatRealtimeAuthService } from './chat-realtime-auth.service.js';

describe('ChatRealtimeAuthService', () => {
  const authUser = {
    id: 'user-1',
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
  };
  const ticketService = {
    consumeTicket: vi.fn(),
  };
  const subscriptionQueryService = {
    canSubscribeThreadForViewer: vi.fn(),
    getThreadDetail: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consumeTicket은 ticket service 결과를 그대로 반환한다', async () => {
    ticketService.consumeTicket.mockResolvedValueOnce(authUser);
    const service = new ChatRealtimeAuthService(
      ticketService as never,
      subscriptionQueryService as never,
    );

    await expect(service.consumeTicket('ticket-1')).resolves.toBe(authUser);
  });

  it('side-effect 없는 subscribe 전용 read 결과가 true면 subscribe 가능하다', async () => {
    subscriptionQueryService.canSubscribeThreadForViewer.mockResolvedValueOnce(true);
    const service = new ChatRealtimeAuthService(
      ticketService as never,
      subscriptionQueryService as never,
    );

    await expect(service.canSubscribeThread(authUser, 'thread-1')).resolves.toBe(true);
    expect(subscriptionQueryService.canSubscribeThreadForViewer).toHaveBeenCalledWith(
      'user-1',
      'thread-1',
    );
    expect(subscriptionQueryService.getThreadDetail).not.toHaveBeenCalled();
  });

  it('subscribe 전용 read가 false면 subscribe를 거절한다', async () => {
    subscriptionQueryService.canSubscribeThreadForViewer.mockResolvedValueOnce(false);
    const service = new ChatRealtimeAuthService(
      ticketService as never,
      subscriptionQueryService as never,
    );

    await expect(service.canSubscribeThread(authUser, 'thread-1')).resolves.toBe(false);
  });

  it('subscribe 전용 read가 예외를 던져도 fail-closed로 거절한다', async () => {
    subscriptionQueryService.canSubscribeThreadForViewer.mockRejectedValueOnce(
      new Error('read failed'),
    );
    const service = new ChatRealtimeAuthService(
      ticketService as never,
      subscriptionQueryService as never,
    );

    await expect(service.canSubscribeThread(authUser, 'thread-1')).resolves.toBe(false);
  });
});
