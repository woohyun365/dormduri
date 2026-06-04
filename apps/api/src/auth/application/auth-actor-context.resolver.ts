import { Injectable } from '@nestjs/common';
import { AuthSessionService } from '../auth-session.service.js';
import type { AuthRequestContext } from '../auth-request-context.js';
import type { ResolvedAuthActorContext } from './auth-actor-context.types.js';

@Injectable()
export class AuthActorContextResolver {
  constructor(private readonly authSessionService: AuthSessionService) {}

  resolveCurrentUserContext(
    token: string | null,
    requestContext?: AuthRequestContext,
  ): Promise<ResolvedAuthActorContext | null> {
    if (requestContext) {
      return this.authSessionService.resolveCurrentUserContext(token, requestContext);
    }
    return this.authSessionService.resolveCurrentUserContext(token);
  }
}
