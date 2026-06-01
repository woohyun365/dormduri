import { ChatRealtimeTicketService } from './chat-realtime-ticket.service.js';

describe('ChatRealtimeTicketService', () => {
  const authUser = {
    id: 'user-1',
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
  };
  let nowMs: number;
  const authSessionService = {
    resolveCurrentUserContext: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    nowMs = Date.parse('2026-02-10T03:00:00.000Z');
    jest.setSystemTime(nowMs);
    authSessionService.resolveCurrentUserContext.mockResolvedValue(authUser);
  });

  afterEach(() => {
    jest.useRealTimers();
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
    jest.setSystemTime(nowMs);

    await expect(service.consumeTicket(issued?.ticket)).resolves.toBeNull();
  });

  it('consume 시 access token session이 revoke/deleted 상태면 실패한다', async () => {
    const service = createService();
    const issued = await service.issueTicketFromAccessToken('access-token-1');
    authSessionService.resolveCurrentUserContext.mockResolvedValueOnce(null);

    await expect(service.consumeTicket(issued?.ticket)).resolves.toBeNull();
  });
});
