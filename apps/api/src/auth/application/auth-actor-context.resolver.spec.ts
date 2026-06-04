import { AuthActorContextResolver } from './auth-actor-context.resolver.js';

describe('AuthActorContextResolver', () => {
  const authSessionService = {
    resolveCurrentUserContext: jest.fn(),
  };
  const resolver = new AuthActorContextResolver(authSessionService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('access token actor context resolution을 AuthSessionService에 위임한다', async () => {
    const actorContext = {
      id: 'user-1',
      sessionId: 'session-1',
      actorType: 'USER' as const,
      actorId: 'user-1',
      gender: 'M' as const,
      campus: 'CHUNCHEON' as const,
      capabilities: ['user:read:self'],
    };
    authSessionService.resolveCurrentUserContext.mockResolvedValue(actorContext);

    await expect(resolver.resolveCurrentUserContext('access-token')).resolves.toBe(actorContext);

    expect(authSessionService.resolveCurrentUserContext).toHaveBeenCalledWith('access-token');
  });

  it('request context가 있으면 session resolver에 그대로 전달한다', async () => {
    const requestContext = {
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      requestId: 'req-1',
    };
    authSessionService.resolveCurrentUserContext.mockResolvedValue(null);

    await expect(
      resolver.resolveCurrentUserContext('access-token', requestContext),
    ).resolves.toBeNull();

    expect(authSessionService.resolveCurrentUserContext).toHaveBeenCalledWith(
      'access-token',
      requestContext,
    );
  });
});
