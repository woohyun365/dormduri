import { Injectable, Optional } from '@nestjs/common';
import type { AuthRequestContext } from '../auth-request-context.js';
import type { GenericSuccessResult } from '../auth.types.js';
import {
  AuthSecurityEventService,
  recordAuthSecurityEventSafely,
} from '../auth-security-event.service.js';
import { parseOpaqueToken, safeCompareTokenHash } from './opaque-token.js';
import { AuthSessionRepository } from './auth-session.repository.js';
import { RevokeSessionsCommand } from './revoke-sessions.command.js';

@Injectable()
export class LogoutSessionCommand {
  constructor(
    private readonly repository: AuthSessionRepository,
    private readonly revokeSessionsCommand: RevokeSessionsCommand,
    @Optional() private readonly securityEvents?: AuthSecurityEventService,
  ) {}

  async execute(
    token: string | null,
    renewalToken: string | null = null,
    requestContext: AuthRequestContext = {},
  ): Promise<GenericSuccessResult> {
    const sessionIds = new Set<string>();

    const parsedRenewalToken = parseOpaqueToken(renewalToken);
    if (parsedRenewalToken) {
      const session = await this.repository.findLogoutSessionByRenewalId(
        parsedRenewalToken.sessionId,
      );
      if (
        session?.refreshTokenHash &&
        safeCompareTokenHash(session.refreshTokenHash, parsedRenewalToken.tokenHash)
      ) {
        sessionIds.add(session.id);
      }
    }

    const parsedAccessToken = parseOpaqueToken(token);
    if (parsedAccessToken) {
      const session = await this.repository.findLogoutSessionByAccessTokenHash(
        parsedAccessToken.tokenHash,
      );
      if (session) {
        sessionIds.add(session.id);
      }
    }

    if (sessionIds.size > 0) {
      const revokedAt = await this.repository.getDatabaseNow();
      const sessionIdList = [...sessionIds];
      const revokeResult = await this.revokeSessionsCommand.revokeSessionIds(
        sessionIdList,
        revokedAt,
      );
      await recordAuthSecurityEventSafely(this.securityEvents, {
        type: 'SESSION_REVOKED',
        severity: 'INFO',
        sessionId: sessionIds.size === 1 ? sessionIdList[0] : undefined,
        requestIp: requestContext.requestIp,
        userAgent: requestContext.userAgent,
        metadata: {
          reason: 'logout',
          revokedCount: revokeResult.count,
        },
      });
    }

    return { success: true };
  }
}
