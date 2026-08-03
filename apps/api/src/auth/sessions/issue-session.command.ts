import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AUTH_ACCESS_TOKEN_TTL_SECONDS,
  AUTH_SESSION_REMEMBER_ME_TTL_SECONDS,
  AUTH_SESSION_TTL_SECONDS,
} from './auth-session.policy.js';
import { createOpaqueToken, hashOpaqueToken } from './opaque-token.js';
import {
  AuthSessionRepository,
  type AuthSessionCreateClient,
  type AuthSessionCreateInput,
} from './auth-session.repository.js';

export interface AuthSessionIssueResult {
  accessToken: string;
  sessionId: string;
  renewalToken: string;
}

export interface PreparedSessionIssue {
  persistence: AuthSessionCreateInput;
  result: AuthSessionIssueResult;
}

@Injectable()
export class IssueSessionCommand {
  constructor(private readonly repository: AuthSessionRepository) {}

  async execute(
    userId: string,
    _email: string,
    rememberMe: boolean,
  ): Promise<AuthSessionIssueResult> {
    const prepared = await this.prepareSessionIssue(userId, rememberMe);
    await this.repository.createSession(prepared.persistence);
    return prepared.result;
  }

  async prepareSessionIssue(userId: string, rememberMe: boolean): Promise<PreparedSessionIssue> {
    const ttlSeconds = rememberMe ? AUTH_SESSION_REMEMBER_ME_TTL_SECONDS : AUTH_SESSION_TTL_SECONDS;
    const databaseNow = await this.repository.getDatabaseNow();
    const sessionId = randomUUID();
    const accessToken = createOpaqueToken(sessionId);
    const sessionTokenExpiresAt = new Date(
      databaseNow.getTime() + AUTH_ACCESS_TOKEN_TTL_SECONDS * 1000,
    );
    const renewalToken = createOpaqueToken(sessionId);

    return {
      persistence: {
        sessionId,
        userId,
        rememberMe,
        sessionTokenHash: hashOpaqueToken(accessToken),
        sessionTokenExpiresAt,
        refreshTokenHash: hashOpaqueToken(renewalToken),
        expiresAt: new Date(databaseNow.getTime() + ttlSeconds * 1000),
      },
      result: {
        accessToken,
        sessionId,
        renewalToken,
      },
    };
  }

  async appendPreparedSession(
    client: AuthSessionCreateClient,
    prepared: PreparedSessionIssue,
  ): Promise<void> {
    await this.repository.createSessionWithClient(client, prepared.persistence);
  }
}
