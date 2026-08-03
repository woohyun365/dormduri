import { Injectable } from '@nestjs/common';
import type { GenericErrorResponse, RenewSessionResponse } from '@repo/shared/auth/response';
import type { ApiSessionResponse } from '@repo/shared/auth/session';
import { hasAuthRequestContext, type AuthRequestContext } from '../domain/auth-request-context.js';
import { AuthSessionService } from './auth-session.service.js';

@Injectable()
export class AuthSessionUseCases {
  constructor(private readonly sessionService: AuthSessionService) {}

  getSession(
    token: string | null,
    requestContext: AuthRequestContext = {},
  ): Promise<ApiSessionResponse> {
    if (!hasAuthRequestContext(requestContext)) {
      return this.sessionService.getSession(token);
    }
    return this.sessionService.getSession(token, requestContext);
  }

  renewSession(
    renewalToken: string | null,
    requestContext: AuthRequestContext = {},
  ): Promise<RenewSessionResponse> {
    if (!hasAuthRequestContext(requestContext)) {
      return this.sessionService.renewSession(renewalToken);
    }
    return this.sessionService.renewSession(renewalToken, requestContext);
  }

  logout(
    token: string | null,
    renewalToken: string | null = null,
    requestContext: AuthRequestContext = {},
  ): Promise<GenericErrorResponse> {
    if (!hasAuthRequestContext(requestContext)) {
      return this.sessionService.logout(token, renewalToken);
    }
    return this.sessionService.logout(token, renewalToken, requestContext);
  }
}
