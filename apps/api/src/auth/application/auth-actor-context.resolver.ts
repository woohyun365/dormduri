import { Injectable } from '@nestjs/common';
import { CurrentSessionQuery } from '../sessions/current-session.query.js';
import type { AuthRequestContext } from '../auth-request-context.js';
import type { ResolvedAuthActorContext } from './auth-actor-context.types.js';

@Injectable()
export class AuthActorContextResolver {
  constructor(private readonly currentSessionQuery: CurrentSessionQuery) {}

  resolveCurrentUserContext(
    token: string | null,
    requestContext?: AuthRequestContext,
  ): Promise<ResolvedAuthActorContext | null> {
    if (requestContext) {
      return this.currentSessionQuery.resolveCurrentUserContext(token, requestContext);
    }
    return this.currentSessionQuery.resolveCurrentUserContext(token);
  }
}
