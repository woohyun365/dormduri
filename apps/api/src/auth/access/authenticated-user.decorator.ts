import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedRequest,
  AuthenticatedUserContext,
} from '../application/auth-actor-context.types.js';

interface CurrentUserOptions {
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
