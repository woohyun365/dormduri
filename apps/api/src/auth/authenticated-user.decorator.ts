import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUserContext } from './auth-session.service.js';
import type { AuthenticatedRequest } from './authenticated-user.guard.js';

export const AuthenticatedUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUserContext => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authUser) {
      throw new Error('[AuthenticatedUser] guard must run before decorator');
    }
    return request.authUser;
  },
);
