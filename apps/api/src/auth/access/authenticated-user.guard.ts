import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { forbiddenError, unauthorizedError } from '../../common/http/api-error.js';
import {
  AUTH_ACCESS_METADATA_KEY,
  AUTH_REQUIRED_CAPABILITIES_METADATA_KEY,
  type AuthAccessMode,
} from './auth-access.decorator.js';
import type { AuthCapability } from './auth-capability.js';
import { resolveBearerAuthToken } from './auth-token.js';
import { AuthActorContextResolver } from '../application/auth-actor-context.resolver.js';
import type { AuthenticatedRequest } from '../application/auth-actor-context.types.js';
import {
  hasAuthRequestContext,
  resolveAuthRequestContext,
} from '../domain/auth-request-context.js';

@Injectable()
export class AuthenticatedUserGuard implements CanActivate {
  constructor(
    private readonly authActorContextResolver: AuthActorContextResolver,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const accessMode = this.resolveAccessMode(context);
    if (accessMode === 'public') {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = resolveBearerAuthToken(request.headers.authorization);
    if (accessMode === 'optional' && !token) {
      return true;
    }

    const requestContext = resolveAuthRequestContext(request);
    const authUser = await (hasAuthRequestContext(requestContext)
      ? this.authActorContextResolver.resolveCurrentUserContext(token, requestContext)
      : this.authActorContextResolver.resolveCurrentUserContext(token));

    if (!authUser && accessMode === 'optional') {
      return true;
    }

    if (!authUser) {
      throw unauthorizedError('UNAUTHENTICATED', '로그인이 필요합니다.');
    }

    const requiredCapabilities = this.resolveRequiredCapabilities(context);
    if (!hasRequiredCapabilities(authUser.capabilities, requiredCapabilities)) {
      throw forbiddenError('INSUFFICIENT_CAPABILITY', '요청을 수행할 권한이 없습니다.', {
        requiredCapabilities,
      });
    }

    request.authUser = authUser;
    return true;
  }

  private resolveAccessMode(context: ExecutionContext): AuthAccessMode {
    return (
      this.reflector.getAllAndOverride<AuthAccessMode>(AUTH_ACCESS_METADATA_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'protected'
    );
  }

  private resolveRequiredCapabilities(context: ExecutionContext): readonly AuthCapability[] {
    const classCapabilities =
      this.reflector.get<readonly AuthCapability[]>(
        AUTH_REQUIRED_CAPABILITIES_METADATA_KEY,
        context.getClass(),
      ) ?? [];
    const handlerCapabilities =
      this.reflector.get<readonly AuthCapability[]>(
        AUTH_REQUIRED_CAPABILITIES_METADATA_KEY,
        context.getHandler(),
      ) ?? [];

    return [...classCapabilities, ...handlerCapabilities];
  }
}

function hasRequiredCapabilities(
  actorCapabilities: readonly AuthCapability[],
  requiredCapabilities: readonly AuthCapability[],
) {
  if (requiredCapabilities.length === 0) {
    return true;
  }

  const actorCapabilitySet = new Set(actorCapabilities);
  return requiredCapabilities.every((capability) => actorCapabilitySet.has(capability));
}
