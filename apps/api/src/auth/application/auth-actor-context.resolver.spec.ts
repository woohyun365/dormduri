import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthActorContextResolver } from './auth-actor-context.resolver.js';

describe('AuthActorContextResolver', () => {
  const currentSessionQuery = {
    resolveCurrentUserContext: vi.fn(),
  };
  const resolver = new AuthActorContextResolver(currentSessionQuery as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('access token actor context resolution을 CurrentSessionQuery에 위임한다', async () => {
    const actorContext = {
      id: 'user-1',
      sessionId: 'session-1',
      actorType: 'USER' as const,
      actorId: 'user-1',
      gender: 'M' as const,
      campus: 'CHUNCHEON' as const,
      capabilities: ['user:read:self'],
    };
    currentSessionQuery.resolveCurrentUserContext.mockResolvedValue(actorContext);

    await expect(resolver.resolveCurrentUserContext('access-token')).resolves.toBe(actorContext);

    expect(currentSessionQuery.resolveCurrentUserContext).toHaveBeenCalledWith('access-token');
  });

  it('request context가 있으면 current session query에 그대로 전달한다', async () => {
    const requestContext = {
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      requestId: 'req-1',
    };
    currentSessionQuery.resolveCurrentUserContext.mockResolvedValue(null);

    await expect(
      resolver.resolveCurrentUserContext('access-token', requestContext),
    ).resolves.toBeNull();

    expect(currentSessionQuery.resolveCurrentUserContext).toHaveBeenCalledWith(
      'access-token',
      requestContext,
    );
  });
});
