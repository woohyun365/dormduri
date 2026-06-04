import { Injectable } from '@nestjs/common';
import type {
  AuthSessionIssueResult,
  GenericSuccessResult,
  RenewSessionResult,
  SessionStatusResult,
} from './auth.types.js';
import type { AuthRequestContext } from './auth-request-context.js';
import { CurrentSessionQuery } from './sessions/current-session.query.js';
import { IssueSessionCommand } from './sessions/issue-session.command.js';
import { RenewSessionCommand } from './sessions/renew-session.command.js';
import { LogoutSessionCommand } from './sessions/logout-session.command.js';
import type { ResolvedAuthActorContext } from './application/auth-actor-context.types.js';
export type {
  AuthenticatedUserContext,
  ResolvedAuthActorContext,
} from './application/auth-actor-context.types.js';

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly currentSessionQuery: CurrentSessionQuery,
    private readonly issueSessionCommand: IssueSessionCommand,
    private readonly renewSessionCommand: RenewSessionCommand,
    private readonly logoutSessionCommand: LogoutSessionCommand,
  ) {}

  getSession(
    token: string | null,
    requestContext: AuthRequestContext = {},
  ): Promise<SessionStatusResult> {
    return this.currentSessionQuery.getSession(token, requestContext);
  }

  resolveCurrentUserContext(
    token: string | null,
    requestContext: AuthRequestContext = {},
  ): Promise<ResolvedAuthActorContext | null> {
    return this.currentSessionQuery.resolveCurrentUserContext(token, requestContext);
  }

  issueAuthResult(
    userId: string,
    email: string,
    rememberMe: boolean,
  ): Promise<AuthSessionIssueResult> {
    return this.issueSessionCommand.execute(userId, email, rememberMe);
  }

  renewSession(
    renewalToken: string | null,
    requestContext: AuthRequestContext = {},
  ): Promise<RenewSessionResult> {
    return this.renewSessionCommand.execute(renewalToken, requestContext);
  }

  logout(
    token: string | null,
    renewalToken: string | null = null,
    requestContext: AuthRequestContext = {},
  ): Promise<GenericSuccessResult> {
    return this.logoutSessionCommand.execute(token, renewalToken, requestContext);
  }
}
