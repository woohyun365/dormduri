import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedRequest,
  AuthenticatedUserContext,
} from '../application/auth-actor-context.types.js';
import { resolveBearerAuthToken } from './auth-token.js';

interface CurrentUserOptions {
  optional?: boolean;
}

interface CurrentAuthTokenOptions {
  optional?: boolean;
}

export const CurrentUser = createParamDecorator(
  (
    data: CurrentUserOptions | undefined,
    context: ExecutionContext,
  ): AuthenticatedUserContext | null => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authUser) {
      if (data?.optional) {
        return null;
      }

      throw new Error('[CurrentUser] guard must run before decorator');
    }
    return request.authUser;
  },
);

export const AuthenticatedUser = CurrentUser;

export const CurrentAuthToken = createParamDecorator(
  (data: CurrentAuthTokenOptions | undefined, context: ExecutionContext): string | null => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = resolveBearerAuthToken(request.headers.authorization);
    if (!token && !data?.optional) {
      throw new Error('[CurrentAuthToken] bearer token is required');
    }
    return token;
  },
);
