import { Injectable } from '@nestjs/common';
import type {
  AuthSessionIssueResult,
  GenericSuccessResult,
  RenewSessionResult,
  SessionStatusResult,
} from '../domain/auth.types.js';
import type { AuthRequestContext } from '../domain/auth-request-context.js';
import { CurrentSessionQuery } from './current-session.query.js';
import { IssueSessionCommand } from './issue-session.command.js';
import type { PreparedSessionIssue } from './issue-session.command.js';
import type { AuthSessionCreateClient } from './auth-session.repository.js';
import { RenewSessionCommand } from './renew-session.command.js';
import { LogoutSessionCommand } from './logout-session.command.js';
import type { ResolvedAuthActorContext } from '../application/auth-actor-context.types.js';
export type {
  AuthenticatedUserContext,
  ResolvedAuthActorContext,
} from '../application/auth-actor-context.types.js';

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

  prepareSessionIssue(
    userId: string,
    _email: string,
    rememberMe: boolean,
  ): Promise<PreparedSessionIssue> {
    return this.issueSessionCommand.prepareSessionIssue(userId, rememberMe);
  }

  appendPreparedSession(
    client: AuthSessionCreateClient,
    prepared: PreparedSessionIssue,
  ): Promise<void> {
    return this.issueSessionCommand.appendPreparedSession(client, prepared);
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
