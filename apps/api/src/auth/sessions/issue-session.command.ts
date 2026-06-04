import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AUTH_ACCESS_TOKEN_TTL_SECONDS,
  AUTH_SESSION_REMEMBER_ME_TTL_SECONDS,
  AUTH_SESSION_TTL_SECONDS,
} from '../auth.constants.js';
import type { AuthSessionIssueResult } from '../auth.types.js';
import { createOpaqueToken, hashOpaqueToken } from './opaque-token.js';
import { AuthSessionRepository } from './auth-session.repository.js';

@Injectable()
export class IssueSessionCommand {
  constructor(private readonly repository: AuthSessionRepository) {}

  async execute(
    userId: string,
    _email: string,
    rememberMe: boolean,
  ): Promise<AuthSessionIssueResult> {
    const ttlSeconds = rememberMe ? AUTH_SESSION_REMEMBER_ME_TTL_SECONDS : AUTH_SESSION_TTL_SECONDS;
    const databaseNow = await this.repository.getDatabaseNow();
    const sessionId = randomUUID();
    const accessToken = createOpaqueToken(sessionId);
    const sessionTokenExpiresAt = new Date(
      databaseNow.getTime() + AUTH_ACCESS_TOKEN_TTL_SECONDS * 1000,
    );
    const renewalToken = rememberMe ? createOpaqueToken(sessionId) : undefined;

    const session = await this.repository.createSession({
      sessionId,
      userId,
      rememberMe,
      sessionTokenHash: hashOpaqueToken(accessToken),
      sessionTokenExpiresAt,
      ...(renewalToken ? { refreshTokenHash: hashOpaqueToken(renewalToken) } : {}),
      expiresAt: new Date(databaseNow.getTime() + ttlSeconds * 1000),
    });

    return {
      accessToken,
      sessionId: session.id,
      ...(renewalToken ? { renewalToken } : {}),
    };
  }
}
