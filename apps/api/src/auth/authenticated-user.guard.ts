import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { unauthorizedError } from '../common/http/api-error.js';
import { AuthSessionService, type AuthenticatedUserContext } from './auth-session.service.js';

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUserContext;
}

@Injectable()
export class AuthenticatedUserGuard implements CanActivate {
  constructor(private readonly authSessionService: AuthSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    const authUser = await this.authSessionService.resolveCurrentUserContext(token);

    if (!authUser) {
      throw unauthorizedError('UNAUTHENTICATED', '로그인이 필요합니다.');
    }

    request.authUser = authUser;
    return true;
  }
}
