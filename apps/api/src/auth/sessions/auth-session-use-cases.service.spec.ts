import { AuthSessionUseCases } from './auth-session-use-cases.service.js';

describe('AuthSessionUseCases', () => {
  const sessionService = {
    getSession: jest.fn(),
    renewSession: jest.fn(),
    logout: jest.fn(),
  };
  const useCases = new AuthSessionUseCases(sessionService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('request context가 없으면 session service에 legacy two-arg 이하 shape로 위임한다', async () => {
    sessionService.getSession.mockResolvedValueOnce({ authenticated: false });
    sessionService.renewSession.mockResolvedValueOnce({
      success: false,
      code: 'AUTH_SESSION_RENEWAL_REQUIRED',
    });
    sessionService.logout.mockResolvedValueOnce({ success: true });

    await expect(useCases.getSession('access-token')).resolves.toEqual({ authenticated: false });
    await expect(useCases.renewSession('renewal-token')).resolves.toMatchObject({
      success: false,
      code: 'AUTH_SESSION_RENEWAL_REQUIRED',
    });
    await expect(useCases.logout('access-token', 'renewal-token')).resolves.toEqual({
      success: true,
    });

    expect(sessionService.getSession).toHaveBeenCalledWith('access-token');
    expect(sessionService.renewSession).toHaveBeenCalledWith('renewal-token');
    expect(sessionService.logout).toHaveBeenCalledWith('access-token', 'renewal-token');
  });

  it('request context가 있으면 session service에 audit context를 함께 전달한다', async () => {
    const requestContext = { requestIp: '127.0.0.1', userAgent: 'jest' };
    sessionService.getSession.mockResolvedValueOnce({ authenticated: true });
    sessionService.renewSession.mockResolvedValueOnce({ success: true, accessToken: 'access' });
    sessionService.logout.mockResolvedValueOnce({ success: true });

    await expect(useCases.getSession('access-token', requestContext)).resolves.toEqual({
      authenticated: true,
    });
    await expect(useCases.renewSession('renewal-token', requestContext)).resolves.toEqual({
      success: true,
      accessToken: 'access',
    });
    await expect(useCases.logout('access-token', 'renewal-token', requestContext)).resolves.toEqual(
      {
        success: true,
      },
    );

    expect(sessionService.getSession).toHaveBeenCalledWith('access-token', requestContext);
    expect(sessionService.renewSession).toHaveBeenCalledWith('renewal-token', requestContext);
    expect(sessionService.logout).toHaveBeenCalledWith(
      'access-token',
      'renewal-token',
      requestContext,
    );
  });
});
