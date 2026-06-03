import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_CAPABILITIES } from './auth-capability.js';
import { OptionalAuth, Public, RequireCapability } from './auth-access.decorator.js';
import { CurrentUser } from './authenticated-user.decorator.js';
import { AuthenticatedUserGuard, type AuthenticatedRequest } from './authenticated-user.guard.js';

class GuardFixtureController {
  @Public()
  publicRoute() {
    return 'public';
  }

  @OptionalAuth()
  optionalRoute() {
    return 'optional';
  }

  protectedRoute() {
    return 'protected';
  }

  @RequireCapability(AUTH_CAPABILITIES.USER_UPDATE_SELF)
  updateSelfRoute() {
    return 'capability';
  }

  @RequireCapability('admin:security-event:read')
  futureAdminRoute() {
    return 'future-admin';
  }

  currentUserRoute(@CurrentUser() _authUser: unknown) {
    return 'current-user';
  }
}

function makeExecutionContext(
  handlerName: keyof GuardFixtureController,
  request: Partial<AuthenticatedRequest> = {},
): ExecutionContext {
  const httpRequest = request as AuthenticatedRequest;
  httpRequest.headers ??= {};

  return {
    getClass: () => GuardFixtureController,
    getHandler: () => GuardFixtureController.prototype[handlerName],
    switchToHttp: () => ({
      getRequest: () => httpRequest,
    }),
  } as unknown as ExecutionContext;
}

describe('AuthenticatedUserGuard access metadata', () => {
  const authSessionService = {
    resolveCurrentUserContext: jest.fn(),
  };
  const guard = new AuthenticatedUserGuard(authSessionService as never, new Reflector());

  const actorContext = {
    id: 'user-1',
    actorType: 'USER' as const,
    actorId: 'user-1',
    sessionId: 'session-1',
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
    capabilities: [
      AUTH_CAPABILITIES.USER_READ_SELF,
      AUTH_CAPABILITIES.USER_UPDATE_SELF,
      AUTH_CAPABILITIES.AUTH_PASSWORD_CHANGE_SELF,
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('@Public route는 auth resolution 없이 통과한다', async () => {
    await expect(guard.canActivate(makeExecutionContext('publicRoute'))).resolves.toBe(true);

    expect(authSessionService.resolveCurrentUserContext).not.toHaveBeenCalled();
  });

  it('@OptionalAuth route는 토큰이 없으면 nullable actor context로 통과한다', async () => {
    const request = { headers: {} };

    await expect(guard.canActivate(makeExecutionContext('optionalRoute', request))).resolves.toBe(
      true,
    );

    expect(request).not.toHaveProperty('authUser');
    expect(authSessionService.resolveCurrentUserContext).not.toHaveBeenCalled();
  });

  it('@OptionalAuth route는 토큰이 있으면 opaque session resolve 결과를 actor context로 사용한다', async () => {
    authSessionService.resolveCurrentUserContext.mockResolvedValue(actorContext);
    const request = { headers: { authorization: 'Bearer opaque-token' } };

    await expect(guard.canActivate(makeExecutionContext('optionalRoute', request))).resolves.toBe(
      true,
    );

    expect(authSessionService.resolveCurrentUserContext).toHaveBeenCalledWith('opaque-token');
    expect(request).toHaveProperty('authUser', actorContext);
  });

  it('@OptionalAuth route는 토큰 resolve가 실패해도 nullable actor context로 통과한다', async () => {
    authSessionService.resolveCurrentUserContext.mockResolvedValue(null);
    const request = { headers: { authorization: 'Bearer old-or-expired-token' } };

    await expect(guard.canActivate(makeExecutionContext('optionalRoute', request))).resolves.toBe(
      true,
    );

    expect(authSessionService.resolveCurrentUserContext).toHaveBeenCalledWith(
      'old-or-expired-token',
    );
    expect(request).not.toHaveProperty('authUser');
  });

  it('protected route는 missing/invalid actor context를 fail-closed 처리한다', async () => {
    authSessionService.resolveCurrentUserContext.mockResolvedValue(null);

    await expect(
      guard.canActivate(
        makeExecutionContext('protectedRoute', {
          headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature' },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('@RequireCapability route는 missing capability를 fail-closed 처리한다', async () => {
    authSessionService.resolveCurrentUserContext.mockResolvedValue({
      ...actorContext,
      capabilities: [AUTH_CAPABILITIES.USER_READ_SELF],
    });

    await expect(
      guard.canActivate(
        makeExecutionContext('updateSelfRoute', {
          headers: { authorization: 'Bearer opaque-token' },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('@RequireCapability route는 required capability가 있으면 actor context를 request에 고정한다', async () => {
    authSessionService.resolveCurrentUserContext.mockResolvedValue(actorContext);
    const request = { headers: { authorization: 'Bearer opaque-token' } };

    await expect(guard.canActivate(makeExecutionContext('updateSelfRoute', request))).resolves.toBe(
      true,
    );

    expect(request).toHaveProperty('authUser', actorContext);
  });

  it('future admin capability naming은 구현 없이 metadata로만 표현할 수 있다', () => {
    const handler = Object.getOwnPropertyDescriptor(
      GuardFixtureController.prototype,
      'futureAdminRoute',
    )?.value as object | undefined;
    expect(handler).toBeDefined();
    if (!handler) {
      throw new Error('Expected futureAdminRoute handler');
    }

    expect(Reflect.getMetadata('auth:required-capabilities', handler)).toEqual([
      'admin:security-event:read',
    ]);
  });
});
