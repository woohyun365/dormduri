import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatRealtimeTicketService } from './chat-realtime-ticket.service.js';

describe('ChatRealtimeTicketService', () => {
  const authUser = {
    id: 'user-1',
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
  };
  let nowMs: number;
  const authSessionService = {
    resolveCurrentUserContext: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    nowMs = Date.parse('2026-02-10T03:00:00.000Z');
    vi.setSystemTime(nowMs);
    authSessionService.resolveCurrentUserContext.mockResolvedValue(authUser);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createService() {
    return new ChatRealtimeTicketService(authSessionService as never);
  }

  it('valid access token은 60초 TTL chat realtime ticket으로 교환된다', async () => {
    const service = createService();

    const issued = await service.issueTicketFromAccessToken('access-token-1');

    expect(issued).toMatchObject({
      scope: 'chat:realtime',
      expiresAt: '2026-02-10T03:01:00.000Z',
    });
    expect(issued?.ticket).toEqual(expect.any(String));
    expect(authSessionService.resolveCurrentUserContext).toHaveBeenCalledWith('access-token-1');
  });

  it('ticket은 one-time consume이고 consume 시 session revocation/deleted user를 다시 검증한다', async () => {
    const service = createService();
    const issued = await service.issueTicketFromAccessToken('access-token-1');
    expect(issued).not.toBeNull();

    await expect(service.consumeTicket(issued?.ticket)).resolves.toEqual(authUser);
    await expect(service.consumeTicket(issued?.ticket)).resolves.toBeNull();
    expect(authSessionService.resolveCurrentUserContext).toHaveBeenCalledTimes(2);
  });

  it('만료된 ticket은 connection 인증에 실패한다', async () => {
    const service = createService();
    const issued = await service.issueTicketFromAccessToken('access-token-1');
    expect(issued).not.toBeNull();

    nowMs += 60_001;
    vi.setSystemTime(nowMs);

    await expect(service.consumeTicket(issued?.ticket)).resolves.toBeNull();
  });

  it('consume 시 access token session이 revoke/deleted 상태면 실패한다', async () => {
    const service = createService();
    const issued = await service.issueTicketFromAccessToken('access-token-1');
    authSessionService.resolveCurrentUserContext.mockResolvedValueOnce(null);

    await expect(service.consumeTicket(issued?.ticket)).resolves.toBeNull();
    await expect(service.consumeTicket(issued?.ticket)).resolves.toBeNull();
    expect(authSessionService.resolveCurrentUserContext).toHaveBeenCalledTimes(2);
  });

  it('첫 consume의 재검증이 pending이어도 두 번째 consume은 resolver를 다시 호출하지 않는다', async () => {
    const service = createService();
    const issued = await service.issueTicketFromAccessToken('access-token-1');
    expect(issued).not.toBeNull();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    authSessionService.resolveCurrentUserContext.mockImplementationOnce(async () => {
      await pending;
      return authUser;
    });
    const first = service.consumeTicket(issued?.ticket);
    try {
      expect(authSessionService.resolveCurrentUserContext).toHaveBeenCalledTimes(2);
      await expect(service.consumeTicket(issued?.ticket)).resolves.toBeNull();
      expect(authSessionService.resolveCurrentUserContext).toHaveBeenCalledTimes(2);
      release();
      await expect(first).resolves.toEqual(authUser);
    } finally {
      release();
      await Promise.allSettled([first]);
    }
  });

  it('재검증이 throw해도 이미 소비된 ticket을 복원하지 않는다', async () => {
    const service = createService();
    const issued = await service.issueTicketFromAccessToken('access-token-1');
    expect(issued).not.toBeNull();
    const error = new Error('revalidation unavailable');
    authSessionService.resolveCurrentUserContext.mockRejectedValueOnce(error);

    await expect(service.consumeTicket(issued?.ticket)).rejects.toBe(error);
    await expect(service.consumeTicket(issued?.ticket)).resolves.toBeNull();
    expect(authSessionService.resolveCurrentUserContext).toHaveBeenCalledTimes(2);
  });

  it('다른 service instance는 발급 ticket을 소비할 수 없고 발급 instance의 ticket도 지우지 않는다', async () => {
    const issuer = createService();
    const other = createService();
    const issued = await issuer.issueTicketFromAccessToken('access-token-1');
    expect(issued).not.toBeNull();

    await expect(other.consumeTicket(issued?.ticket)).resolves.toBeNull();
    expect(authSessionService.resolveCurrentUserContext).toHaveBeenCalledTimes(1);
    await expect(issuer.consumeTicket(issued?.ticket)).resolves.toEqual(authUser);
    expect(authSessionService.resolveCurrentUserContext).toHaveBeenCalledTimes(2);
  });
});
