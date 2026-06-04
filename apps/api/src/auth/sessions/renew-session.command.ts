import { Injectable, Optional } from '@nestjs/common';
import { AUTH_ACCESS_TOKEN_TTL_SECONDS } from '../auth.constants.js';
import type { AuthRequestContext } from '../auth-request-context.js';
import type { RenewSessionResult } from '../auth.types.js';
import { authFailures } from '../errors/auth-failures.js';
import {
  AuthSecurityEventService,
  recordAuthSecurityEventSafely,
} from '../auth-security-event.service.js';
import { AUTH_SECURITY_EVENT_METRICS } from '../auth-security-event.types.js';
import { createOpaqueToken, hashOpaqueToken, parseOpaqueToken } from './opaque-token.js';
import { AuthSessionRepository } from './auth-session.repository.js';
import { isRenewalTokenReuse, resolveRenewalRejectionReason } from './session-lifecycle.policy.js';

@Injectable()
export class RenewSessionCommand {
  constructor(
    private readonly repository: AuthSessionRepository,
    @Optional() private readonly securityEvents?: AuthSecurityEventService,
  ) {}

  async execute(
    renewalToken: string | null,
    requestContext: AuthRequestContext = {},
  ): Promise<RenewSessionResult> {
    const parsedRenewalToken = parseOpaqueToken(renewalToken);
    if (!parsedRenewalToken) {
      await this.recordOpaqueTransportRejected('renewal', 'malformed_or_legacy', requestContext);
      return authFailures.sessionRenewalRequired();
    }

    const databaseNow = await this.repository.getDatabaseNow();
    const nextAccessToken = createOpaqueToken(parsedRenewalToken.sessionId);
    const nextAccessTokenHash = hashOpaqueToken(nextAccessToken);
    const nextAccessTokenExpiresAt = new Date(
      databaseNow.getTime() + AUTH_ACCESS_TOKEN_TTL_SECONDS * 1000,
    );
    const nextRenewalToken = createOpaqueToken(parsedRenewalToken.sessionId);
    const nextRenewalTokenHash = hashOpaqueToken(nextRenewalToken);

    const renewalAttempt = await this.repository.runSerializableTransaction(async (tx) => {
      const session = await this.repository.findRenewalSessionById(
        tx,
        parsedRenewalToken.sessionId,
      );
      const rejectedReason = resolveRenewalRejectionReason(session, databaseNow);
      if (rejectedReason) {
        return null;
      }

      const currentRefreshTokenHash = session?.refreshTokenHash;
      if (!session || !currentRefreshTokenHash) {
        return null;
      }

      if (
        isRenewalTokenReuse(
          { refreshTokenHash: currentRefreshTokenHash },
          parsedRenewalToken.tokenHash,
        )
      ) {
        await this.repository.revokeSessionById(tx, session.id, databaseNow);
        return { kind: 'reused' as const };
      }

      const rotation = await this.repository.rotateRenewalToken(tx, {
        sessionId: session.id,
        currentRefreshTokenHash,
        nextRenewalTokenHash,
        nextAccessTokenHash,
        nextAccessTokenExpiresAt,
        databaseNow,
      });

      if (rotation.count !== 1) {
        return null;
      }

      return {
        kind: 'renewed' as const,
      };
    });

    if (!renewalAttempt) {
      return authFailures.sessionRenewalRequired();
    }

    if (renewalAttempt.kind === 'reused') {
      await recordAuthSecurityEventSafely(this.securityEvents, {
        type: 'SESSION_TOKEN_REUSE_DETECTED',
        severity: 'WARNING',
        sessionId: parsedRenewalToken.sessionId,
        requestIp: requestContext.requestIp,
        userAgent: requestContext.userAgent,
        metadata: {
          metricName: AUTH_SECURITY_EVENT_METRICS.tokenReuse,
          tokenKind: 'renewal',
        },
      });
      return authFailures.sessionRenewalReused();
    }

    await recordAuthSecurityEventSafely(this.securityEvents, {
      type: 'SESSION_REFRESH_SUCCESS',
      severity: 'INFO',
      sessionId: parsedRenewalToken.sessionId,
      requestIp: requestContext.requestIp,
      userAgent: requestContext.userAgent,
      metadata: {
        rememberMe: true,
      },
    });

    return {
      success: true,
      accessToken: nextAccessToken,
      renewalToken: nextRenewalToken,
      rememberMe: true,
    };
  }

  private async recordOpaqueTransportRejected(
    tokenKind: 'access' | 'renewal',
    reason: string,
    requestContext: AuthRequestContext,
    context: { sessionId?: string; targetUserId?: string } = {},
  ) {
    await recordAuthSecurityEventSafely(this.securityEvents, {
      type: 'OPAQUE_TRANSPORT_REJECTED',
      severity: 'WARNING',
      targetUserId: context.targetUserId,
      sessionId: context.sessionId,
      requestIp: requestContext.requestIp,
      userAgent: requestContext.userAgent,
      metadata: {
        tokenKind,
        reason,
      },
    });
  }
}
